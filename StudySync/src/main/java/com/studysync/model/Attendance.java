package com.studysync.model;

public class Attendance {
    private int id; private int userId; private String subject; private int attended; private int total;
    public Attendance() {}
    public Attendance(int id,int userId,String subject,int attended,int total){this.id=id;this.userId=userId;this.subject=subject;this.attended=attended;this.total=total;}
    public int getId(){return id;} public void setId(int id){this.id=id;}
    public int getUserId(){return userId;} public void setUserId(int userId){this.userId=userId;}
    public String getSubject(){return subject;} public void setSubject(String subject){this.subject=subject;}
    public int getAttended(){return attended;} public void setAttended(int attended){this.attended=attended;}
    public int getTotal(){return total;} public void setTotal(int total){this.total=total;}
}
