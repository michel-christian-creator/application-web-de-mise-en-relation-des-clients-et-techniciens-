package com.mboatech.backend.config;

import com.mboatech.backend.controller.AuthController;
import com.mboatech.backend.model.Role;
import com.mboatech.backend.model.User;
import com.mboatech.backend.repository.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import java.util.Optional;

/**
 * Filtre d'authentification global : valide le jeton opaque sur chaque requête
 * (header "Authorization: Bearer ..." ou paramètre "?token=..." pour SSE et
 * WebSocket, qui ne peuvent pas envoyer de header) et peuple le SecurityContext.
 *
 * Les contrôleurs conservent leurs vérifications manuelles en défense en
 * profondeur ; ce filtre est le filet de sécurité : tout endpoint oublié est
 * rejeté par défaut (voir SecurityConfig).
 */
@Component
public class TokenAuthenticationFilter extends OncePerRequestFilter {

    private final UserRepository userRepository;

    public TokenAuthenticationFilter(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String token = extractToken(request);
        if (token != null && !token.isBlank()
                && SecurityContextHolder.getContext().getAuthentication() == null) {
            Optional<User> optionalUser = AuthController.authenticateToken("Bearer " + token, userRepository);
            if (optionalUser.isPresent()) {
                User user = optionalUser.get();
                Role role = user.getRole();
                String authority = "ROLE_" + (role != null ? role.name().toLowerCase() : "user");
                UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                        user, token, List.of(new SimpleGrantedAuthority(authority)));
                authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                SecurityContextHolder.getContext().setAuthentication(authentication);
            }
        }
        chain.doFilter(request, response);
    }

    private String extractToken(HttpServletRequest request) {
        String header = request.getHeader("Authorization");
        if (header != null && !header.isBlank()) {
            return header.startsWith("Bearer ") ? header.substring(7) : header;
        }
        String query = request.getParameter("token");
        if (query != null && !query.isBlank()) {
            return query;
        }
        return null;
    }
}
