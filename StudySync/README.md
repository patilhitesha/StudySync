# StudySync – Collaborative Study Workspace

This project keeps the original uploaded StudySync UI/design and separates it into files.

## Main frontend
- `src/main/webapp/index.html` – original UI markup
- `src/main/webapp/css/style.css` – original CSS extracted from StudySync.html
- `src/main/webapp/js/script.js` – original JavaScript extracted from StudySync.html

The browser prototype therefore keeps the same visual output and client-side behavior as the uploaded StudySync file.

## Java / Advanced Java
- Core Java models and services
- JDBC connection and DAO classes
- Servlet API endpoints
- JSP demonstration page
- MySQL SQL schema

Database defaults are set to MySQL `localhost:3307`, database `studysync_db`, user `root`, password `root@123`. Change `DBConnection.java` if your MySQL settings differ.

## Run original UI quickly
Open `src/main/webapp/index.html` in a browser. No server is required for the original client-side prototype.

## Run Java backend
1. Start MySQL.
2. Run `sql/studysync_db.sql` in MySQL Workbench/phpMyAdmin.
3. Install JDK 25+ and Maven.
4. Deploy the generated `target/StudySync.war` to Tomcat 9.
5. Open `/StudySync/`.

The current original UI still uses its local browser store, so the Java API is included as the syllabus backend foundation without changing the uploaded UI.
