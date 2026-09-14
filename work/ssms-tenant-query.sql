-- Run this at the top of each new SSMS query window before reading app.* tables.
USE [ServiceDeskDev];
GO

DECLARE @BusinessId uniqueidentifier = '11111111-1111-1111-1111-111111111111';

EXEC sys.sp_set_session_context
    @key = N'BusinessId',
    @value = @BusinessId,
    @read_only = 0;

SELECT
    SESSION_CONTEXT(N'BusinessId') AS ActiveBusinessId;

SELECT * FROM app.Customers ORDER BY CreatedAt DESC;
SELECT * FROM app.Jobs ORDER BY CreatedAt DESC;
SELECT * FROM app.JobItems ORDER BY CreatedAt DESC;
SELECT * FROM app.CatalogItems ORDER BY CreatedAt DESC;

-- Optional: clear the tenant context when inspection is finished.
-- EXEC sys.sp_set_session_context @key = N'BusinessId', @value = NULL, @read_only = 0;
