-- Apply after schema/security/reference data. These are database backstops;
-- API transactions still enforce authorization, totals, approval and seat rules.
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO
CREATE TRIGGER app.TR_Jobs_Transitions ON app.Jobs AFTER UPDATE AS
BEGIN
 SET NOCOUNT ON;
 IF EXISTS (
  SELECT 1 FROM inserted i JOIN deleted d ON i.BusinessId=d.BusinessId AND i.Id=d.Id
  WHERE i.Status<>d.Status AND NOT (
   (d.Status='Draft' AND i.Status IN ('Scheduled','Cancelled')) OR
   (d.Status='Scheduled' AND i.Status IN ('InProgress','OnHold','Cancelled')) OR
   (d.Status='InProgress' AND i.Status IN ('OnHold','Completed','Cancelled')) OR
   (d.Status='OnHold' AND i.Status IN ('Scheduled','InProgress','Cancelled')) OR
   (d.Status='Completed' AND i.Status='InProgress')
  )
 ) THROW 51001,'Invalid job status transition.',1;
END;
GO
CREATE TRIGGER app.TR_InvoiceItems_DraftOnly ON app.InvoiceItems AFTER INSERT,UPDATE,DELETE AS
BEGIN
 SET NOCOUNT ON;
 IF EXISTS (
  SELECT 1 FROM (SELECT BusinessId,InvoiceId FROM inserted UNION SELECT BusinessId,InvoiceId FROM deleted) c
  JOIN app.Invoices i ON i.BusinessId=c.BusinessId AND i.Id=c.InvoiceId
  WHERE i.Status<>'Draft'
 ) THROW 51002,'Issued invoice items are immutable. Use a credit or a new invoice.',1;
END;
GO
CREATE TRIGGER app.TR_Invoices_IssueAndProtect ON app.Invoices AFTER INSERT,UPDATE AS
BEGIN
 SET NOCOUNT ON;
 IF EXISTS (SELECT 1 FROM inserted i LEFT JOIN deleted d ON i.BusinessId=d.BusinessId AND i.Id=d.Id
            WHERE d.Id IS NULL AND i.Status<>'Draft')
  THROW 51003,'Create an invoice as Draft before issuing.',1;
 IF EXISTS (SELECT 1 FROM inserted i JOIN deleted d ON i.BusinessId=d.BusinessId AND i.Id=d.Id
            WHERE i.Status<>d.Status AND NOT ((d.Status='Draft' AND i.Status='Issued') OR (d.Status='Issued' AND i.Status='Voided')))
  THROW 51004,'Invalid invoice lifecycle transition.',1;
 IF EXISTS (
  SELECT 1 FROM inserted i JOIN deleted d ON i.BusinessId=d.BusinessId AND i.Id=d.Id
  WHERE d.Status<>'Draft' AND (
   i.CustomerId<>d.CustomerId OR i.JobId<>d.JobId OR i.InvoiceNumber<>d.InvoiceNumber OR
   i.Currency<>d.Currency OR i.Subtotal<>d.Subtotal OR i.DiscountTotal<>d.DiscountTotal OR
   i.TaxTotal<>d.TaxTotal OR i.Total<>d.Total OR i.IssuedOn<>d.IssuedOn OR i.DueOn<>d.DueOn OR
   ISNULL(i.BillingSnapshot,N'')<>ISNULL(d.BillingSnapshot,N'')
  )
 ) THROW 51005,'Issued financial fields are immutable.',1;
 IF EXISTS (
  SELECT 1 FROM inserted i JOIN deleted d ON i.BusinessId=d.BusinessId AND i.Id=d.Id
  OUTER APPLY (SELECT COUNT_BIG(*) AS C, SUM(CONVERT(decimal(19,2),ROUND(Quantity*UnitPrice,2))) AS Sub,
              SUM(DiscountAmount) AS Disc,SUM(TaxAmount) AS Tax,SUM(LineTotal) AS Total
              FROM app.InvoiceItems l WHERE l.BusinessId=i.BusinessId AND l.InvoiceId=i.Id) a
  WHERE d.Status='Draft' AND i.Status='Issued' AND
   (a.C=0 OR i.Subtotal<>a.Sub OR i.DiscountTotal<>a.Disc OR i.TaxTotal<>a.Tax OR i.Total<>a.Total)
 ) THROW 51006,'Invoice header totals must match its line items before issue.',1;
 IF EXISTS (
  SELECT 1 FROM inserted i JOIN deleted d ON i.BusinessId=d.BusinessId AND i.Id=d.Id
  WHERE i.Status='Voided' AND d.Status<>'Voided' AND (
   NULLIF(LTRIM(RTRIM(i.VoidReason)),N'') IS NULL OR
   EXISTS (SELECT 1 FROM app.Payments p WHERE p.BusinessId=i.BusinessId AND p.InvoiceId=i.Id AND p.Status IN ('Pending','Succeeded')) OR
   EXISTS (SELECT 1 FROM app.CreditNotes c WHERE c.BusinessId=i.BusinessId AND c.InvoiceId=i.Id)
  )
 ) THROW 51007,'Void requires a reason and no pending/succeeded payment or credit history.',1;
END;
GO
CREATE TRIGGER app.TR_EstimateItems_DraftOnly ON app.EstimateItems AFTER INSERT,UPDATE,DELETE AS
BEGIN
 SET NOCOUNT ON;
 IF EXISTS (
  SELECT 1 FROM (SELECT BusinessId,EstimateId FROM inserted UNION SELECT BusinessId,EstimateId FROM deleted) c
  JOIN app.Estimates e ON e.BusinessId=c.BusinessId AND e.Id=c.EstimateId
  WHERE e.Status<>'Draft'
 ) THROW 51008,'Sent estimate items are immutable. Create a revision.',1;
END;
GO
CREATE TRIGGER app.TR_Payments_ProtectSucceeded ON app.Payments AFTER UPDATE AS
BEGIN
 SET NOCOUNT ON;
 IF EXISTS (SELECT 1 FROM inserted i JOIN deleted d ON i.BusinessId=d.BusinessId AND i.Id=d.Id
            WHERE d.Status='Succeeded' AND (i.Status<>d.Status OR i.Amount<>d.Amount OR i.InvoiceId<>d.InvoiceId OR i.Method<>d.Method
              OR ISNULL(i.ExternalReference,N'')<>ISNULL(d.ExternalReference,N'') OR ISNULL(i.PaidAt,'19000101')<>ISNULL(d.PaidAt,'19000101')))
  THROW 51009,'Succeeded payments are immutable. Record a refund.',1;
END;
GO
