import java.sql.*;
public class CheckAdm {
  public static void main(String[] a) throws Exception {
    Connection c = DriverManager.getConnection("jdbc:mysql://localhost:3306/mboatech?useSSL=false&allowPublicKeyRetrieval=true", "root", "");
    ResultSet r = c.createStatement().executeQuery("SELECT COUNT(*) FROM users WHERE id = 17");
    r.next(); System.out.println("users id=17 count: " + r.getInt(1));
    ResultSet r2 = c.createStatement().executeQuery("SELECT COUNT(*) FROM users WHERE role = 'admin'");
    r2.next(); System.out.println("admins in users: " + r2.getInt(1));
    ResultSet r3 = c.createStatement().executeQuery("SELECT COUNT(*) FROM notifications WHERE user_id = 1000000000000");
    r3.next(); System.out.println("notifications remapped to new admin: " + r3.getInt(1));
    c.close();
  }
}
