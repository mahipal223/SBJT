-- Run ONLY on an isolated verification database after scripts 01-04.
-- Expected failures are caught; all fixture rows are rolled back.
IF DB_NAME() NOT LIKE 'ServiceDeskSpecTest%'
 THROW 51100,'Use a dedicated database named ServiceDeskSpecTest... for these tests.',1;
SET NOCOUNT ON;
SET XACT_ABORT OFF;
DECLARE @a uniqueidentifier=NEWID(), @b uniqueidentifier=NEWID(), @u uniqueidentifier=NEWID(),
 @ma uniqueidentifier=NEWID(), @mb uniqueidentifier=NEWID(), @ca uniqueidentifier=NEWID(),
 @cb uniqueidentifier=NEWID(), @ca2 uniqueidentifier=NEWID(), @loc uniqueidentifier=NEWID(),
 @ja uniqueidentifier=NEWID(), @jb uniqueidentifier=NEWID(), @inv uniqueidentifier=NEWID(), @line uniqueidentifier=NEWID();
BEGIN TRY
 BEGIN TRANSACTION;
 INSERT auth.Users(Id,Subject,Email,NormalizedEmail,FullName)
 VALUES (@u,CONVERT(nvarchar(36),@u),N'test@example.invalid',CONVERT(nvarchar(36),@u),N'Test Owner');
 EXEC sys.sp_set_session_context @key=N'BusinessId',@value=@a;
 INSERT platform.Businesses(Id,Name,TimeZone,BillingEmail) VALUES (@a,N'A',N'America/Chicago',N'a@example.invalid');
 INSERT app.Members(BusinessId,Id,UserId,RoleCode) VALUES (@a,@ma,@u,N'Owner');
 INSERT app.Customers(BusinessId,Id,Name) VALUES (@a,@ca,N'Customer A'),(@a,@ca2,N'Other customer A');
 INSERT app.Locations(BusinessId,Id,CustomerId,Label,AddressLine1,City,StateCode,PostalCode)
 VALUES (@a,@loc,@ca2,N'Site',N'10 Test St',N'Austin','TX',N'78701');
 INSERT app.Jobs(BusinessId,Id,CustomerId,JobNumber,Title,CreatedByMemberId)
 VALUES (@a,@ja,@ca,N'JOB-0001',N'A job',@ma);
 EXEC sys.sp_set_session_context @key=N'BusinessId',@value=@b;
 INSERT platform.Businesses(Id,Name,TimeZone,BillingEmail) VALUES (@b,N'B',N'America/New_York',N'b@example.invalid');
 INSERT app.Members(BusinessId,Id,UserId,RoleCode) VALUES (@b,@mb,@u,N'Owner');
 INSERT app.Customers(BusinessId,Id,Name) VALUES (@b,@cb,N'Customer B');
 INSERT app.Jobs(BusinessId,Id,CustomerId,JobNumber,Title,CreatedByMemberId)
 VALUES (@b,@jb,@cb,N'JOB-0001',N'B job',@mb);
 EXEC sys.sp_set_session_context @key=N'BusinessId',@value=@a;
 IF EXISTS(SELECT 1 FROM app.Customers WHERE BusinessId=@b) THROW 51101,'Cross-tenant read leaked.',1;
 IF (SELECT COUNT(*) FROM app.Jobs)<>1 THROW 51102,'Tenant job count incorrect.',1;
 PRINT 'PASS: tenant filtering and per-business job numbering';
 BEGIN TRY
  INSERT app.Customers(BusinessId,Name) VALUES (@b,N'Forbidden');
  THROW 51103,'Cross-tenant insert was accepted.',1;
 END TRY BEGIN CATCH
  IF ERROR_NUMBER()<>33504 THROW;
 END CATCH;
 PRINT 'PASS: cross-tenant insert blocked';
 BEGIN TRY
  UPDATE app.Jobs SET CustomerId=@cb WHERE BusinessId=@a AND Id=@ja;
  THROW 51104,'Cross-tenant relationship was accepted.',1;
 END TRY BEGIN CATCH IF ERROR_NUMBER()<>547 THROW; END CATCH;
 BEGIN TRY
  UPDATE app.Jobs SET LocationId=@loc WHERE BusinessId=@a AND Id=@ja;
  THROW 51105,'Wrong-customer service location was accepted.',1;
 END TRY BEGIN CATCH IF ERROR_NUMBER()<>547 THROW; END CATCH;
 PRINT 'PASS: cross-tenant and wrong-customer foreign keys blocked';
 BEGIN TRY
  UPDATE app.Jobs SET Status='Unknown' WHERE BusinessId=@a AND Id=@ja;
  THROW 51106,'Invalid job status was accepted.',1;
 END TRY BEGIN CATCH IF ERROR_NUMBER()<>547 THROW; END CATCH;
 INSERT app.Invoices(BusinessId,Id,JobId,CustomerId,InvoiceNumber,DueOn,Subtotal,Total)
 VALUES (@a,@inv,@ja,@ca,N'INV-0001','20260923',100,100);
 INSERT app.InvoiceItems(BusinessId,Id,InvoiceId,Description,Quantity,Unit,UnitPrice)
 VALUES (@a,@line,@inv,N'Diagnostic',1,N'visit',100);
 UPDATE app.Invoices SET Status='Issued',IssuedOn='20260909',BillingSnapshot=N'{"name":"Customer A"}' WHERE BusinessId=@a AND Id=@inv;
 IF NOT EXISTS(SELECT 1 FROM app.Invoices WHERE Id=@inv AND Status='Issued') THROW 51107,'Valid invoice issue failed.',1;
 PRINT 'PASS: valid invoice totals and issue';
 EXEC sys.sp_set_session_context @key=N'BusinessId',@value=NULL;
 IF EXISTS(SELECT 1 FROM app.Jobs) THROW 51108,'Missing context did not fail closed.',1;
 PRINT 'PASS: missing context returns no tenant rows';
 ROLLBACK TRANSACTION;
 EXEC sys.sp_set_session_context @key=N'BusinessId',@value=NULL;
 PRINT 'PASS: smoke suite complete; fixtures rolled back';
END TRY
BEGIN CATCH
 IF @@TRANCOUNT>0 ROLLBACK TRANSACTION;
 EXEC sys.sp_set_session_context @key=N'BusinessId',@value=NULL;
 THROW;
END CATCH;
GO
