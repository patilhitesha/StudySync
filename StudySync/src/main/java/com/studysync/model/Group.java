package com.studysync.model;

public class Group {
    private int id; private String name; private String subject; private String description; private String code; private int ownerId;
    public Group() {}
    public Group(int id,String name,String subject,String description,String code,int ownerId){this.id=id;this.name=name;this.subject=subject;this.description=description;this.code=code;this.ownerId=ownerId;}
    public int getId(){return id;} public void setId(int id){this.id=id;}
    public String getName(){return name;} public void setName(String name){this.name=name;}
    public String getSubject(){return subject;} public void setSubject(String subject){this.subject=subject;}
    public String getDescription(){return description;} public void setDescription(String description){this.description=description;}
    public String getCode(){return code;} public void setCode(String code){this.code=code;}
    public int getOwnerId(){return ownerId;} public void setOwnerId(int ownerId){this.ownerId=ownerId;}
}
