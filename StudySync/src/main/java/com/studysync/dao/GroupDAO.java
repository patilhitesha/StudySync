package com.studysync.dao;

import com.studysync.model.Group;
import com.studysync.util.DBConnection;
import java.sql.*; import java.util.*;

public class GroupDAO {
    public int save(Group g) throws SQLException { String sql="INSERT INTO study_groups(name,subject,description,code,owner_id) VALUES(?,?,?,?,?)"; try(Connection c=DBConnection.getConnection();PreparedStatement p=c.prepareStatement(sql,Statement.RETURN_GENERATED_KEYS)){p.setString(1,g.getName());p.setString(2,g.getSubject());p.setString(3,g.getDescription());p.setString(4,g.getCode());p.setInt(5,g.getOwnerId());p.executeUpdate();ResultSet r=p.getGeneratedKeys();return r.next()?r.getInt(1):0;} }
    public Group findByCode(String code) throws SQLException { String sql="SELECT * FROM study_groups WHERE code=?"; try(Connection c=DBConnection.getConnection();PreparedStatement p=c.prepareStatement(sql)){p.setString(1,code);ResultSet r=p.executeQuery();if(r.next())return map(r);return null;} }
    public List<Group> findByUser(int userId) throws SQLException { List<Group> list=new ArrayList<Group>(); String sql="SELECT g.* FROM study_groups g JOIN group_members m ON g.id=m.group_id WHERE m.user_id=? ORDER BY g.id DESC"; try(Connection c=DBConnection.getConnection();PreparedStatement p=c.prepareStatement(sql)){p.setInt(1,userId);ResultSet r=p.executeQuery();while(r.next())list.add(map(r));} return list; }
    public void addMember(int groupId,int userId) throws SQLException { String sql="INSERT IGNORE INTO group_members(group_id,user_id) VALUES(?,?)"; try(Connection c=DBConnection.getConnection();PreparedStatement p=c.prepareStatement(sql)){p.setInt(1,groupId);p.setInt(2,userId);p.executeUpdate();} }
    private Group map(ResultSet r)throws SQLException{return new Group(r.getInt("id"),r.getString("name"),r.getString("subject"),r.getString("description"),r.getString("code"),r.getInt("owner_id"));}
}
