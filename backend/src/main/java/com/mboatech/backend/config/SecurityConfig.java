package com.mboatech.backend.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.util.Arrays;
import java.util.List;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private static final Logger logger = LoggerFactory.getLogger(SecurityConfig.class);
    private final TokenAuthenticationFilter tokenAuthenticationFilter;
    private final List<String> allowedOrigins;

    public SecurityConfig(TokenAuthenticationFilter tokenAuthenticationFilter,
                          @Value("${app.cors.allowed-origins:http://localhost:5173}") String allowedOrigins) {
        this.tokenAuthenticationFilter = tokenAuthenticationFilter;
        this.allowedOrigins = Arrays.stream(allowedOrigins.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList();
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .csrf().disable()
            .cors().and()
            .sessionManagement().sessionCreationPolicy(SessionCreationPolicy.STATELESS).and()
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/auth/login", "/api/register").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/technicians", "/api/technicians/categories").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/technicians/{id}/recommendations").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/technicians/{id}/portfolio").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/settings/payments").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/public/stats").permitAll()
                .requestMatchers("/api/payments/webhook", "/uploads/**", "/error").permitAll()
                .anyRequest().authenticated());
        http.addFilterBefore(tokenAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        if (allowedOrigins.isEmpty()) {
            logger.warn("Aucun origine CORS configuré. Autorisation des origines de développement uniquement. Configurez app.cors.allowed-origins pour la production.");
            configuration.addAllowedOrigin("http://localhost:5173");
            configuration.addAllowedOrigin("http://localhost:5174");
            configuration.addAllowedOrigin("http://localhost:3000");
        } else {
            configuration.setAllowedOrigins(allowedOrigins);
        }
        configuration.addAllowedMethod("*");
        configuration.addAllowedHeader("*");
        configuration.setAllowCredentials(true);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
}
