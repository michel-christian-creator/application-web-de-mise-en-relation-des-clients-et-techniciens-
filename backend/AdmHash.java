import java.sql.*;
public class AdmHash {
  public static void main(String[] a) throws Exception {
    Connection c = DriverManager.getConnection("jdbc:mysql://localhost:3306/mboatech?useSSL=false&allowPublicKeyRetrieval=true", "root", "");
    ResultSet rs = c.createStatement().executeQuery("SELECT id, username, email, password_hash FROM users WHERE role = 'admin'");
    while (rs.next()) System.out.println("id=" + rs.getLong(1) + " user=" + rs.getString(2) + " email=" + rs.getString(3) + " hash=" + rs.getString(4));
    c.close();
  }
}
