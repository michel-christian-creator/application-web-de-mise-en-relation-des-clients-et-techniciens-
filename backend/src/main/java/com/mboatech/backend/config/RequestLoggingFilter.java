package com.mboatech.backend.config;

import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

@Component
public class RequestLoggingFilter implements Filter {

    private static final DateTimeFormatter FMT = DateTimeFormatter.ofPattern("MM-dd HH:mm:ss.SSS");
    private static final Path LOG_FILE = Path.of("C:\\Users\\MDA Services\\Desktop\\Design mboa-tech\\backend\\requests.log");

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain) throws IOException, ServletException {
        HttpServletRequest req = (HttpServletRequest) request;
        long start = System.currentTimeMillis();
        try {
            chain.doFilter(request, response);
            int status = ((HttpServletResponse) response).getStatus();
            logLine("OK  status=" + status + " " + req.getMethod() + " " + req.getRequestURI() + " auth=" + safeAuth(req) + " ms=" + (System.currentTimeMillis() - start));
        } catch (Throwable t) {
            logLine("ERR " + req.getMethod() + " " + req.getRequestURI() + " auth=" + safeAuth(req) + " ex=" + t.getClass().getSimpleName() + ": " + t.getMessage());
            throw t;
        }
    }

    private static String safeAuth(HttpServletRequest req) {
        String auth = req.getHeader("Authorization");
        if (auth == null || auth.isBlank()) {
            return "none";
        }
        return auth.length() > 40 ? auth.substring(0, 40) + "..." : auth;
    }

    private static synchronized void logLine(String line) {
        try {
            Files.createDirectories(LOG_FILE.getParent());
            Files.writeString(LOG_FILE, LocalDateTime.now().format(FMT) + "  " + line + System.lineSeparator(),
                    StandardOpenOption.CREATE, StandardOpenOption.APPEND);
        } catch (IOException ignored) {
        }
    }
}
