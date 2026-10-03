package com.studysync.dao;
import com.studysync.model.Note; import com.studysync.util.DBConnection; import java.sql.*; import java.util.*;
public class NoteDAO {
 public int save(Note n)throws SQLException{String s="INSERT INTO notes(group_id,author_id,title,content) VALUES(?,?,?,?)";try(Connection c=DBConnection.getConnection();PreparedStatement p=c.prepareStatement(s,Statement.RETURN_GENERATED_KEYS)){p.setInt(1,n.getGroupId());p.setInt(2,n.getAuthorId());p.setString(3,n.getTitle());p.setString(4,n.getContent());p.executeUpdate();ResultSet r=p.getGeneratedKeys();return r.next()?r.getInt(1):0;}}
 public List<Note> findByGroup(int groupId)throws SQLException{List<Note> l=new ArrayList<Note>();String s="SELECT * FROM notes WHERE group_id=? ORDER BY created_at DESC";try(Connection c=DBConnection.getConnection();PreparedStatement p=c.prepareStatement(s)){p.setInt(1,groupId);ResultSet r=p.executeQuery();while(r.next())l.add(new Note(r.getInt("id"),r.getInt("group_id"),r.getInt("author_id"),r.getString("title"),r.getString("content")));}return l;}
}
