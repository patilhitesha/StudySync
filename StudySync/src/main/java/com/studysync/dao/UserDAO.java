package com.studysync.dao;

import com.studysync.model.User;
import com.studysync.util.DBConnection;
import java.sql.*;

public class UserDAO {
    public boolean exists(String email) throws SQLException { String sql="SELECT id FROM users WHERE email=?"; try(Connection c=DBConnection.getConnection();PreparedStatement p=c.prepareStatement(sql)){p.setString(1,email);return p.executeQuery().next();} }
    public int save(User u) throws SQLException { String sql="INSERT INTO users(name,email,password) VALUES(?,?,?)"; try(Connection c=DBConnection.getConnection();PreparedStatement p=c.prepareStatement(sql,Statement.RETURN_GENERATED_KEYS)){p.setString(1,u.getName());p.setString(2,u.getEmail());p.setString(3,u.getPassword());p.executeUpdate();ResultSet r=p.getGeneratedKeys();return r.next()?r.getInt(1):0;} }
    public User login(String email,String password) throws SQLException { String sql="SELECT * FROM users WHERE email=? AND password=?"; try(Connection c=DBConnection.getConnection();PreparedStatement p=c.prepareStatement(sql)){p.setString(1,email);p.setString(2,password);ResultSet r=p.executeQuery();if(r.next())return new User(r.getInt("id"),r.getString("name"),r.getString("email"),r.getString("password"));return null;} }
}
