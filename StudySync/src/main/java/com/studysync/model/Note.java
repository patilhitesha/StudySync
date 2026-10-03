package com.studysync.model;

public class Note {
    private int id; private int groupId; private int authorId; private String title; private String content;
    public Note() {}
    public Note(int id,int groupId,int authorId,String title,String content){this.id=id;this.groupId=groupId;this.authorId=authorId;this.title=title;this.content=content;}
    public int getId(){return id;} public void setId(int id){this.id=id;}
    public int getGroupId(){return groupId;} public void setGroupId(int groupId){this.groupId=groupId;}
    public int getAuthorId(){return authorId;} public void setAuthorId(int authorId){this.authorId=authorId;}
    public String getTitle(){return title;} public void setTitle(String title){this.title=title;}
    public String getContent(){return content;} public void setContent(String content){this.content=content;}
}
