const fs=require('fs'),path=require('path');
const out=path.resolve('outputs/backend-spec');fs.mkdirSync(out,{recursive:true});
const write=(f,s)=>fs.writeFileSync(path.join(out,f),s);
const tables=[];
function table(schema,name,cols,extras=[],tenant=false){tables.push({schema,name,cols,extras,tenant});}
const id='Id uniqueidentifier NOT NULL DEFAULT NEWSEQUENTIALID()';
const stamp=['CreatedAt datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME()','UpdatedAt datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME()','Version rowversion NOT NULL'];
const str=(n,len=200,nullable=false)=>`${n} nvarchar(${len}) ${nullable?'NULL':'NOT NULL'}`;
const guid=(n,nullable=false)=>`${n} uniqueidentifier ${nullable?'NULL':'NOT NULL'}`;
const status=(vals,def=vals[0],name='Status')=>`${name} varchar(32) NOT NULL DEFAULT '${def}' CHECK (${name} IN (${vals.map(x=>`'${x}'`).join(',')}))`;
const money=(n)=>`${n} decimal(19,2) NOT NULL DEFAULT 0 CHECK (${n} >= 0)`;
const json=(n,nullable=true)=>`${n} nvarchar(max) ${nullable?'NULL':'NOT NULL'} CHECK (ISJSON(${n})=1)`;
const fk=(col,target,targetCol='Id',schema='app')=>`FOREIGN KEY (BusinessId,${col}) REFERENCES ${schema}.${target}(BusinessId,${targetCol})`;
function tenant(name,cols,extras=[]){table('app',name,[guid('BusinessId'),id,...cols,...stamp],[`PRIMARY KEY (BusinessId,Id)`,`FOREIGN KEY (BusinessId) REFERENCES platform.Businesses(Id)`,...extras],true);}
table('auth','Users',[id,str('Subject',200),str('Email',254),str('NormalizedEmail',254),str('FullName'),status(['Active','Disabled']),...stamp],['PRIMARY KEY (Id)','UNIQUE (Subject)','UNIQUE (NormalizedEmail)']);
table('auth','Roles',[str('Code',32),str('Name',80)],['PRIMARY KEY (Code)']);
table('auth','Permissions',[str('Code',80),str('Description',300)],['PRIMARY KEY (Code)']);
table('auth','RolePermissions',[str('RoleCode',32),str('PermissionCode',80)],['PRIMARY KEY (RoleCode,PermissionCode)','FOREIGN KEY (RoleCode) REFERENCES auth.Roles(Code)','FOREIGN KEY (PermissionCode) REFERENCES auth.Permissions(Code)']);
table('platform','Businesses',[id,str('Name'),status(['Plumbing','AutoService','Electrical','Other'],'Other','Industry'),status(['Active','Suspended','DeletionPending','Closed']),str('TimeZone',80),"Currency char(3) NOT NULL DEFAULT 'USD' CHECK (Currency='USD')",str('BillingEmail',254),json('Settings'),...stamp],['PRIMARY KEY (Id)']);
tenant('Members',[guid('UserId'),str('RoleCode',32),status(['Active','Inactive']), 'DeactivatedAt datetime2(3) NULL'],['FOREIGN KEY (UserId) REFERENCES auth.Users(Id)','FOREIGN KEY (RoleCode) REFERENCES auth.Roles(Code)','UNIQUE (BusinessId,UserId)']);
tenant('Invitations',[str('Email',254),str('NormalizedEmail',254),str('RoleCode',32),'TokenHash binary(32) NOT NULL',status(['Pending','Accepted','Revoked','Expired']),guid('InvitedByMemberId'),guid('AcceptedByUserId',true),'ExpiresAt datetime2(3) NOT NULL','AcceptedAt datetime2(3) NULL'],[fk('InvitedByMemberId','Members'),'FOREIGN KEY (AcceptedByUserId) REFERENCES auth.Users(Id)','FOREIGN KEY (RoleCode) REFERENCES auth.Roles(Code)',"CHECK (RoleCode IN ('Manager','Technician'))",'UNIQUE (TokenHash)']);
table('platform','Plans',[id,str('Code',40),'Revision int NOT NULL CHECK (Revision>0)',str('Name',100),status(['Month','Year'],'Month','BillingInterval'),money('Price'),"Currency char(3) NOT NULL DEFAULT 'USD'",str('ProviderPriceId',200,true),'IsPublished bit NOT NULL DEFAULT 0',...stamp],['PRIMARY KEY (Id)','UNIQUE (Code,Revision,BillingInterval)']);
table('platform','PlanEntitlements',[guid('PlanId'),str('FeatureCode',60),'Enabled bit NOT NULL DEFAULT 1','LimitValue bigint NULL CHECK (LimitValue IS NULL OR LimitValue>=0)',str('DisplayText',200)],['PRIMARY KEY (PlanId,FeatureCode)','FOREIGN KEY (PlanId) REFERENCES platform.Plans(Id)']);
tenant('Subscriptions',[guid('PlanId'),str('ProviderCustomerId',200,true),str('ProviderSubscriptionId',200,true),status(['Trialing','Active','PastDue','ReadOnly','Ended']), 'TrialEndsAt datetime2(3) NULL','PeriodStartsAt datetime2(3) NOT NULL','PeriodEndsAt datetime2(3) NOT NULL','GraceEndsAt datetime2(3) NULL','CancelAtPeriodEnd bit NOT NULL DEFAULT 0','IsCurrent bit NOT NULL DEFAULT 1'],['FOREIGN KEY (PlanId) REFERENCES platform.Plans(Id)','CHECK (PeriodEndsAt>PeriodStartsAt)']);
tenant('PlanChanges',[guid('SubscriptionId'),guid('TargetPlanId'),status(['Pending','Applied','Blocked','Cancelled']), 'EffectiveAt datetime2(3) NOT NULL',str('BlockedReason',500,true)],[fk('SubscriptionId','Subscriptions'),'FOREIGN KEY (TargetPlanId) REFERENCES platform.Plans(Id)']);
tenant('SubscriptionInvoices',[guid('SubscriptionId'),str('ProviderInvoiceId',200),status(['Open','Paid','Void','Uncollectible']),money('Total'),"Currency char(3) NOT NULL DEFAULT 'USD'",'DueAt datetime2(3) NULL','PaidAt datetime2(3) NULL'],[fk('SubscriptionId','Subscriptions'),'UNIQUE (ProviderInvoiceId)']);
tenant('UsageCounters',[str('FeatureCode',60),'PeriodStartsAt datetime2(3) NOT NULL','PeriodEndsAt datetime2(3) NOT NULL','UsedQuantity bigint NOT NULL DEFAULT 0 CHECK (UsedQuantity>=0)'],['UNIQUE (BusinessId,FeatureCode,PeriodStartsAt)','CHECK (PeriodEndsAt>PeriodStartsAt)']);
tenant('Customers',[str('Name'),str('CompanyName',200,true),str('Email',254,true),str('Phone',32,true),status(['Residential','Commercial'],'Residential','CustomerType'),'ArchivedAt datetime2(3) NULL']);
tenant('Locations',[guid('CustomerId'),str('Label',100),str('AddressLine1'),str('AddressLine2',200,true),str('City',100),'StateCode char(2) NOT NULL',str('PostalCode',10),"CountryCode char(2) NOT NULL DEFAULT 'US'",'ArchivedAt datetime2(3) NULL'],[fk('CustomerId','Customers'),'UNIQUE (BusinessId,CustomerId,Id)']);
tenant('Assets',[guid('CustomerId'),str('AssetType',40),str('Label'),str('VinOrSerial',100,true),json('Details'),'ArchivedAt datetime2(3) NULL'],[fk('CustomerId','Customers'),'UNIQUE (BusinessId,CustomerId,Id)']);
tenant('CatalogItems',[status(['Service','Labor','Part'],'Service','ItemType'),str('Name'),str('Unit',32),money('UnitCost'),'UnitPrice decimal(19,4) NOT NULL DEFAULT 0 CHECK (UnitPrice>=0)',str('TaxCategory',80,true),'ArchivedAt datetime2(3) NULL']);
tenant('NumberSequences',[str('DocumentType',30),'NextValue bigint NOT NULL DEFAULT 1 CHECK (NextValue>0)',str('Prefix',30)],['UNIQUE (BusinessId,DocumentType)']);
tenant('Jobs',[guid('CustomerId'),guid('LocationId',true),guid('AssetId',true),str('JobNumber',40),str('Title'),str('Description','max',true),status(['Draft','Scheduled','InProgress','OnHold','Completed','Cancelled']),status(['Normal','High','Emergency'],'Normal','Priority'),guid('CreatedByMemberId'),json('IndustryDetails'),'CompletedAt datetime2(3) NULL','CancelledAt datetime2(3) NULL'],[fk('CustomerId','Customers'),'FOREIGN KEY (BusinessId,CustomerId,LocationId) REFERENCES app.Locations(BusinessId,CustomerId,Id)','FOREIGN KEY (BusinessId,CustomerId,AssetId) REFERENCES app.Assets(BusinessId,CustomerId,Id)',fk('CreatedByMemberId','Members'),'UNIQUE (BusinessId,JobNumber)','UNIQUE (BusinessId,CustomerId,Id)']);
tenant('JobAssignments',[guid('JobId'),guid('MemberId'),'IsActive bit NOT NULL DEFAULT 1'],[fk('JobId','Jobs'),fk('MemberId','Members'),'UNIQUE (BusinessId,JobId,MemberId)']);
tenant('Appointments',[guid('JobId'),'StartsAt datetime2(3) NOT NULL','EndsAt datetime2(3) NOT NULL',status(['Scheduled','Completed','Cancelled'])],[fk('JobId','Jobs'),'CHECK (EndsAt>StartsAt)','UNIQUE (BusinessId,JobId,Id)']);
tenant('AppointmentStaff',[guid('JobId'),guid('AppointmentId'),guid('MemberId')],['FOREIGN KEY (BusinessId,JobId,AppointmentId) REFERENCES app.Appointments(BusinessId,JobId,Id)','FOREIGN KEY (BusinessId,JobId,MemberId) REFERENCES app.JobAssignments(BusinessId,JobId,MemberId)','UNIQUE (BusinessId,AppointmentId,MemberId)']);
const lineCols=[status(['Service','Labor','Part'],'Service','ItemType'),str('Description',500),'Quantity decimal(12,3) NOT NULL CHECK (Quantity>0)',str('Unit',32),'UnitPrice decimal(19,4) NOT NULL CHECK (UnitPrice>=0)',money('DiscountAmount'),money('TaxAmount'),'SortOrder int NOT NULL DEFAULT 0 CHECK (SortOrder>=0)','CHECK (DiscountAmount <= ROUND(Quantity*UnitPrice,2))','LineTotal AS CONVERT(decimal(19,2),ROUND(Quantity*UnitPrice,2)-DiscountAmount+TaxAmount) PERSISTED'];
tenant('JobItems',[guid('JobId'),guid('CatalogItemId',true),...lineCols,money('UnitCost')],[fk('JobId','Jobs'),fk('CatalogItemId','CatalogItems')]);
tenant('TimeEntries',[guid('JobId'),guid('MemberId'),'StartsAt datetime2(3) NOT NULL','EndsAt datetime2(3) NULL'],[fk('JobId','Jobs'),fk('MemberId','Members'),'CHECK (EndsAt IS NULL OR EndsAt>StartsAt)']);
tenant('JobNotes',[guid('JobId'),guid('AuthorMemberId'),str('Note','max')],[fk('JobId','Jobs'),fk('AuthorMemberId','Members')]);
tenant('JobFiles',[guid('JobId'),guid('UploadedByMemberId'),str('StorageKey',450),str('FileName',255),str('MimeType',100),'SizeBytes bigint NOT NULL CHECK (SizeBytes>=0)',status(['Pending','Scanning','Ready','Rejected'])],[fk('JobId','Jobs'),fk('UploadedByMemberId','Members'),'UNIQUE (BusinessId,StorageKey)']);
tenant('JobChecklistItems',[guid('JobId'),str('Label',300),'IsRequired bit NOT NULL DEFAULT 0','IsCompleted bit NOT NULL DEFAULT 0',guid('CompletedByMemberId',true)],[fk('JobId','Jobs'),fk('CompletedByMemberId','Members')]);
tenant('Estimates',[guid('JobId'),str('EstimateNumber',40),'Revision int NOT NULL DEFAULT 1 CHECK (Revision>0)',status(['Draft','Sent','Approved','Declined','Expired','Superseded']),'ValidUntil date NOT NULL',"Currency char(3) NOT NULL DEFAULT 'USD'",money('Subtotal'),money('DiscountTotal'),money('TaxTotal'),money('Total'),json('CustomerSnapshot'), 'SentAt datetime2(3) NULL'],[fk('JobId','Jobs'),'UNIQUE (BusinessId,EstimateNumber,Revision)','CHECK (Total=Subtotal-DiscountTotal+TaxTotal AND DiscountTotal<=Subtotal)']);
tenant('EstimateItems',[guid('EstimateId'),...lineCols],[fk('EstimateId','Estimates')]);
tenant('EstimateDecisions',[guid('EstimateId'),status(['Approved','Declined'],'Approved','Decision'),str('ApproverName'),str('ApproverEmail',254),str('EvidenceReference',450,true),'DecidedAt datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME()'],[fk('EstimateId','Estimates'),'UNIQUE (BusinessId,EstimateId)']);
tenant('PublicLinks',[guid('EstimateId'),'TokenHash binary(32) NOT NULL','ExpiresAt datetime2(3) NOT NULL','ConsumedAt datetime2(3) NULL','RevokedAt datetime2(3) NULL'],[fk('EstimateId','Estimates'),'UNIQUE (TokenHash)']);
tenant('Invoices',[guid('JobId'),guid('CustomerId'),str('InvoiceNumber',40),status(['Draft','Issued','Voided']),status(['NotSent','Queued','Sent','Failed'],'NotSent','DeliveryStatus'),'IssuedOn date NULL','DueOn date NULL',"Currency char(3) NOT NULL DEFAULT 'USD'",money('Subtotal'),money('DiscountTotal'),money('TaxTotal'),money('Total'),json('BillingSnapshot'),str('VoidReason',500,true)],['FOREIGN KEY (BusinessId,CustomerId,JobId) REFERENCES app.Jobs(BusinessId,CustomerId,Id)','UNIQUE (BusinessId,InvoiceNumber)','CHECK (Total=Subtotal-DiscountTotal+TaxTotal AND DiscountTotal<=Subtotal)',"CHECK (Status='Draft' OR (IssuedOn IS NOT NULL AND DueOn IS NOT NULL AND DueOn>=IssuedOn AND BillingSnapshot IS NOT NULL))"]);
tenant('InvoiceItems',[guid('InvoiceId'),...lineCols],[fk('InvoiceId','Invoices')]);
tenant('Payments',[guid('InvoiceId'),'Amount decimal(19,2) NOT NULL CHECK (Amount>0)',status(['Cash','Check','BankTransfer','Card'],'Cash','Method'),status(['Pending','Succeeded','Failed']),str('ExternalReference',200,true),'PaidAt datetime2(3) NULL',guid('RecordedByMemberId')],[fk('InvoiceId','Invoices'),fk('RecordedByMemberId','Members')]);
tenant('PaymentRefunds',[guid('PaymentId'),'Amount decimal(19,2) NOT NULL CHECK (Amount>0)',status(['Pending','Succeeded','Failed']),str('Reason',500),str('ExternalReference',200,true)],[fk('PaymentId','Payments')]);
tenant('CreditNotes',[guid('InvoiceId'),str('CreditNumber',40),'Amount decimal(19,2) NOT NULL CHECK (Amount>0)',str('Reason',500),guid('CreatedByMemberId')],[fk('InvoiceId','Invoices'),fk('CreatedByMemberId','Members'),'UNIQUE (BusinessId,CreditNumber)']);
tenant('ExportRequests',[guid('RequestedByMemberId'),status(['Customers','Jobs','Invoices','FullBusiness'],'FullBusiness','ExportType'),status(['Queued','Running','Ready','Failed','Expired']),json('Filters'),str('StorageKey',450,true),'ExpiresAt datetime2(3) NULL'],[fk('RequestedByMemberId','Members')]);
tenant('AuditEvents',[guid('ActorUserId',true),str('Action',100),str('EntityType',80),guid('EntityId',true),str('CorrelationId',100),json('Changes')],['FOREIGN KEY (ActorUserId) REFERENCES auth.Users(Id)']);
tenant('Operations',[guid('RequestedByMemberId',true),str('Kind',80),status(['Queued','Running','Ready','Failed']),str('ResultReference',450,true),str('FailureCode',100,true)],[fk('RequestedByMemberId','Members')]);
tenant('OutboxMessages',[str('EventType',100),json('Payload',false),'ProcessedAt datetime2(3) NULL','Attempts int NOT NULL DEFAULT 0','NextAttemptAt datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME()']);
tenant('IdempotencyRecords',[guid('ActorUserId'),str('Operation',120),str('IdempotencyKey',100),'RequestHash binary(32) NOT NULL',status(['InProgress','Completed']),'ResponseCode int NULL','ResponseJson nvarchar(max) NULL','ExpiresAt datetime2(3) NOT NULL'],['FOREIGN KEY (ActorUserId) REFERENCES auth.Users(Id)','UNIQUE (BusinessId,ActorUserId,Operation,IdempotencyKey)']);
table('platform','WebhookEvents',[id,str('Provider',40),str('ProviderEventId',200),guid('BusinessId',true),'PayloadHash binary(32) NOT NULL',status(['Received','Processed','Failed']),'ReceivedAt datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME()','ProcessedAt datetime2(3) NULL'],['PRIMARY KEY (Id)','UNIQUE (Provider,ProviderEventId)','FOREIGN KEY (BusinessId) REFERENCES platform.Businesses(Id)']);
table('platform','Administrators',[guid('UserId'),status(['Support','BillingAdmin','OperationsAdmin'],'Support','RoleCode'),'IsActive bit NOT NULL DEFAULT 1'],['PRIMARY KEY (UserId)','FOREIGN KEY (UserId) REFERENCES auth.Users(Id)']);
tenant('SupportAccessGrants',[guid('AdminUserId'),guid('ApprovedByMemberId'),status(['ReadOnly'],'ReadOnly','Scope'),'ExpiresAt datetime2(3) NOT NULL','RevokedAt datetime2(3) NULL'],['FOREIGN KEY (AdminUserId) REFERENCES platform.Administrators(UserId)',fk('ApprovedByMemberId','Members')]);
table('platform','AdminAuditEvents',[id,guid('ActorUserId'),guid('BusinessId',true),str('Action',100),json('Details'),'CreatedAt datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME()'],['PRIMARY KEY (Id)','FOREIGN KEY (ActorUserId) REFERENCES auth.Users(Id)','FOREIGN KEY (BusinessId) REFERENCES platform.Businesses(Id)']);
table('platform','BackupRuns',[id,str('ProviderReference',450),status(['Running','Succeeded','Failed']),'StartedAt datetime2(3) NOT NULL','CompletedAt datetime2(3) NULL'],['PRIMARY KEY (Id)']);
table('platform','RestoreRuns',[id,guid('BackupRunId'),guid('RequestedByUserId'),str('TargetEnvironment',100),status(['Running','Succeeded','Failed']),'StartedAt datetime2(3) NOT NULL','CompletedAt datetime2(3) NULL'],['PRIMARY KEY (Id)','FOREIGN KEY (BackupRunId) REFERENCES platform.BackupRuns(Id)','FOREIGN KEY (RequestedByUserId) REFERENCES auth.Users(Id)']);
let sql=`-- ServiceDesk initial SQL Server schema. Run ONCE in a new empty database.\n-- SQL Server 2019+ / Azure SQL. Database creation is intentionally separate.\n-- All dates named *At are UTC; *On fields are business-local dates.\nSET XACT_ABORT ON;\nSET ANSI_NULLS ON;\nSET QUOTED_IDENTIFIER ON;\nGO\nCREATE SCHEMA auth;\nGO\nCREATE SCHEMA platform;\nGO\nCREATE SCHEMA app;\nGO\nCREATE SCHEMA security;\nGO\nBEGIN TRANSACTION;\n`;
for(const t of tables)sql+=`\nCREATE TABLE ${t.schema}.${t.name} (\n  ${[...t.cols,...t.extras].join(',\n  ')}\n);\n`;
sql+=`\nCREATE UNIQUE INDEX UX_Invitations_PendingEmail ON app.Invitations(BusinessId,NormalizedEmail) WHERE Status='Pending';
CREATE UNIQUE INDEX UX_Subscriptions_Current ON app.Subscriptions(BusinessId) WHERE IsCurrent=1;
CREATE UNIQUE INDEX UX_Subscriptions_Provider ON app.Subscriptions(ProviderSubscriptionId) WHERE ProviderSubscriptionId IS NOT NULL;
CREATE UNIQUE INDEX UX_Payments_External ON app.Payments(BusinessId,ExternalReference) WHERE ExternalReference IS NOT NULL;
CREATE UNIQUE INDEX UX_Invoices_OneLivePerJob ON app.Invoices(BusinessId,JobId) WHERE Status<>'Voided';
CREATE INDEX IX_Jobs_Status ON app.Jobs(BusinessId,Status,CreatedAt);
CREATE INDEX IX_Jobs_Customer ON app.Jobs(BusinessId,CustomerId,CreatedAt);
CREATE INDEX IX_JobAssignments_Member ON app.JobAssignments(BusinessId,MemberId,IsActive);
CREATE INDEX IX_Appointments_Start ON app.Appointments(BusinessId,StartsAt);
CREATE INDEX IX_Invoices_CustomerDue ON app.Invoices(BusinessId,CustomerId,DueOn);
CREATE INDEX IX_AuditEvents_Time ON app.AuditEvents(BusinessId,CreatedAt);
CREATE INDEX IX_Outbox_Pending ON app.OutboxMessages(BusinessId,NextAttemptAt) WHERE ProcessedAt IS NULL;
COMMIT;
GO
`;
write('01-schema.sql',sql);
let sec=`-- Apply AFTER 01-schema.sql. Missing/wrong session context denies tenant access.\nSET ANSI_NULLS ON;\nSET QUOTED_IDENTIFIER ON;\nGO\nCREATE FUNCTION security.TenantPredicate(@BusinessId uniqueidentifier)\nRETURNS TABLE WITH SCHEMABINDING\nAS RETURN SELECT 1 AS Allowed\nWHERE @BusinessId = TRY_CONVERT(uniqueidentifier,SESSION_CONTEXT(N'BusinessId'));\nGO\n`;
for(const t of [...tables.filter(t=>t.tenant),{schema:'platform',name:'Businesses',root:true}]){const c=t.root?'Id':'BusinessId';sec+=`CREATE SECURITY POLICY security.${t.name}TenantPolicy\nADD FILTER PREDICATE security.TenantPredicate(${c}) ON ${t.schema}.${t.name},\nADD BLOCK PREDICATE security.TenantPredicate(${c}) ON ${t.schema}.${t.name} AFTER INSERT,\nADD BLOCK PREDICATE security.TenantPredicate(${c}) ON ${t.schema}.${t.name} AFTER UPDATE\nWITH (STATE=ON,SCHEMABINDING=ON);\nGO\n`;}
sec+=`CREATE ROLE servicedesk_app;
GO
GRANT SELECT,INSERT,UPDATE ON SCHEMA::app TO servicedesk_app;
GRANT SELECT,UPDATE ON OBJECT::platform.Businesses TO servicedesk_app;
GRANT SELECT ON OBJECT::platform.Plans TO servicedesk_app;
GRANT SELECT ON OBJECT::platform.PlanEntitlements TO servicedesk_app;
GRANT SELECT ON OBJECT::auth.Roles TO servicedesk_app;
GRANT SELECT ON OBJECT::auth.Permissions TO servicedesk_app;
GRANT SELECT ON OBJECT::auth.RolePermissions TO servicedesk_app;
DENY UPDATE,DELETE ON OBJECT::app.AuditEvents TO servicedesk_app;
DENY UPDATE,DELETE ON OBJECT::app.EstimateDecisions TO servicedesk_app;
DENY UPDATE,DELETE ON OBJECT::app.CreditNotes TO servicedesk_app;
DENY INSERT,UPDATE,DELETE ON OBJECT::app.SupportAccessGrants TO servicedesk_app;
GO
-- Provisioning, billing webhook and platform operations use separate narrowly
-- granted service principals/procedures. Never grant db_owner to the API.
-- RLS is a tenant boundary, not a staff permission or authentication system.
-- The API validates membership BEFORE setting BusinessId. See tenant-boundaries.md.
`;
write('02-tenant-security.sql',sec);
const permissions={
 'workspace.read':['Owner','Manager','Technician'],'workspace.manage':['Owner'],'team.manage':['Owner'],'subscription.manage':['Owner'],
 'customers.read':['Owner','Manager'],'customers.write':['Owner','Manager'],'catalog.read':['Owner','Manager'],'catalog.write':['Owner','Manager'],
 'jobs.read':['Owner','Manager'],'jobs.assigned.read':['Technician'],'jobs.write':['Owner','Manager'],'jobs.assign':['Owner','Manager'],'jobs.work':['Owner','Manager','Technician'],
 'estimates.manage':['Owner','Manager'],'invoices.manage':['Owner','Manager'],'payments.manage':['Owner','Manager'],'reports.read':['Owner','Manager'],'exports.manage':['Owner'], 'audit.read':['Owner'],'support.approve':['Owner']};
let seed=`-- Roles are fixed for MVP; custom roles are deferred. No production prices are seeded.\nSET XACT_ABORT ON;\nBEGIN TRANSACTION;\nINSERT auth.Roles(Code,Name) VALUES (N'Owner',N'Business owner'),(N'Manager',N'Office manager'),(N'Technician',N'Technician');\n`;
for(const [p,rs] of Object.entries(permissions)){seed+=`INSERT auth.Permissions(Code,Description) VALUES (N'${p}',N'${p}');\n`;for(const r of rs)seed+=`INSERT auth.RolePermissions(RoleCode,PermissionCode) VALUES (N'${r}',N'${p}');\n`;}
seed+='COMMIT;\n';write('03-reference-data.sql',seed);
write('schema-metadata.json',JSON.stringify(tables,null,2));
let er='# Database relationships\n\nSQL Server. Composite tenant keys are `(BusinessId, Id)`. All app tables reference Businesses; those repeated edges are omitted below for readability.\n\n';
for(const [title,names] of Object.entries({'Access and subscriptions':['Users','Roles','RolePermissions','Members','Invitations','Businesses','Plans','PlanEntitlements','Subscriptions','PlanChanges','SubscriptionInvoices','UsageCounters'],'Service operations':['Customers','Locations','Assets','CatalogItems','Jobs','JobAssignments','Appointments','AppointmentStaff','JobItems','TimeEntries','JobNotes','JobFiles','JobChecklistItems'],'Documents and controls':['Estimates','EstimateItems','EstimateDecisions','PublicLinks','Invoices','InvoiceItems','Payments','PaymentRefunds','CreditNotes','ExportRequests','AuditEvents','SupportAccessGrants','BackupRuns','RestoreRuns']})){
 er+=`## ${title}\n\n\`\`\`mermaid\nerDiagram\n`;
 for(const t of tables.filter(t=>names.includes(t.name))){er+=`    ${t.name} {\n`;for(const col of t.cols.filter(c=>!c.startsWith('CHECK')).slice(0,7)){const [n,ty]=col.split(' ');er+=`        ${ty.replace(/\(.*/, '').replace('uniqueidentifier','uuid')} ${n}${n==='Id'?' PK':''}\n`;}er+='    }\n';for(const e of t.extras){const m=e.match(/REFERENCES (\w+)\.(\w+)/);if(m&&m[2]!=='Businesses')er+=`    ${m[2]} ||--o{ ${t.name} : "references"\n`;}}
 er+='```\n\n';
}
er+='Optional nullable foreign keys are shown as general one-to-many relationships here; SQL is authoritative for nullability and constraints.\n';write('relationships.md',er);
write('roles.md','# Roles and permissions\n\nA user is global; a role belongs to their membership in a particular business. The same user may own one business and work for another. Platform administrators do not inherit business access.\n\n| Permission | Owner | Manager | Technician |\n|---|---|---|---|\n'+Object.entries(permissions).map(([p,rs])=>'| '+p+' | '+['Owner','Manager','Technician'].map(r=>rs.includes(r)?'Yes':'No').join(' | ')+' |').join('\n')+'\n\nTechnician access is further restricted to currently assigned jobs and linked customer contact/location details. Technician DTOs exclude prices, costs, invoices and billing data. `jobs.work` permits notes, time, checklists and allowed work-status changes only; it does not permit reassignment or pricing changes.\n\nExports and audit history are owner-only in MVP. Managers get aggregate reports, not unrestricted exports. Ownership transfer is a dedicated atomic action, never a normal role edit. At least one active owner must remain.\n');
module.exports={out,write,tables,permissions};
