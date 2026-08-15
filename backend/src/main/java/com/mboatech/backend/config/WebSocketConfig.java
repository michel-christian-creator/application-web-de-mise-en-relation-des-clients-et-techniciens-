package com.mboatech.backend.config;

import com.mboatech.backend.websocket.ChatWebSocketHandler;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

import java.util.Arrays;
import java.util.List;

@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final ChatWebSocketHandler chatWebSocketHandler;
    private final List<String> allowedOrigins;

    public WebSocketConfig(ChatWebSocketHandler chatWebSocketHandler,
                           @Value("${app.cors.allowed-origins:http://localhost:5173}") String allowedOrigins) {
        this.chatWebSocketHandler = chatWebSocketHandler;
        this.allowedOrigins = Arrays.stream(allowedOrigins.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList();
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(chatWebSocketHandler, "/ws/chat/{requestId}")
                .setAllowedOrigins(allowedOrigins.toArray(new String[0]));
    }
}
