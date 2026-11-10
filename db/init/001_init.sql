IF DB_ID(N'studentdb') IS NULL EXEC(N'CREATE DATABASE studentdb');
GO
USE studentdb;
GO
IF OBJECT_ID(N'dbo.students', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.students (
        id INT IDENTITY(1,1) CONSTRAINT PK_students PRIMARY KEY,
        student_id VARCHAR(10) NOT NULL CONSTRAINT UQ_students_student_id UNIQUE,
        fullname NVARCHAR(100) NOT NULL,
        dob DATE NOT NULL,
        major NVARCHAR(50) NOT NULL,
        gpa DECIMAL(3,2) NOT NULL CONSTRAINT DF_students_gpa DEFAULT 0,
        avatar_key NVARCHAR(250) NULL,
        created_at DATETIME2 NOT NULL CONSTRAINT DF_students_created_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT CK_students_gpa CHECK (gpa BETWEEN 0 AND 4)
    );
END;
GO
IF NOT EXISTS (SELECT 1 FROM dbo.students WHERE student_id = 'SV001')
    INSERT dbo.students(student_id, fullname, dob, major, gpa)
    VALUES ('SV001', N'Nguyễn Minh An', '2004-03-12', N'Khoa học máy tính', 3.60);
IF NOT EXISTS (SELECT 1 FROM dbo.students WHERE student_id = 'SV002')
    INSERT dbo.students(student_id, fullname, dob, major, gpa)
    VALUES ('SV002', N'Trần Bảo Linh', '2004-07-20', N'Hệ thống thông tin', 3.45);
IF NOT EXISTS (SELECT 1 FROM dbo.students WHERE student_id = 'SV003')
    INSERT dbo.students(student_id, fullname, dob, major, gpa)
    VALUES ('SV003', N'Lê Hoàng Nam', '2003-11-09', N'Điện toán đám mây', 3.80);
