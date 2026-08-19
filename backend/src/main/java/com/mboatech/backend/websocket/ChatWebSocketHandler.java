package com.mboatech.backend.websocket;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mboatech.backend.controller.ChatController;
import com.mboatech.backend.model.ChatMessage;
import com.mboatech.backend.model.User;
import com.mboatech.backend.service.ChatAccessService;
import com.mboatech.backend.service.ChatEventService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.time.LocalDateTime;
import java.util.Map;

@Component
public class ChatWebSocketHandler extends TextWebSocketHandler {

    private static final Logger logger = LoggerFactory.getLogger(ChatWebSocketHandler.class);
    private static final String CONNECTED = "{\"type\":\"connected\"}";

    private final ChatEventService chatEventService;
    private final ChatController chatController;
    private final ChatAccessService chatAccessService;
    private final ObjectMapper objectMapper;

    public ChatWebSocketHandler(ChatEventService chatEventService, ChatController chatController,
                                ChatAccessService chatAccessService, ObjectMapper objectMapper) {
        this.chatEventService = chatEventService;
        this.chatController = chatController;
        this.chatAccessService = chatAccessService;
        this.objectMapper = objectMapper;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        Long requestId = requestIdFrom(session);
        User user = authenticatedUser(session);
        if (requestId == null || user == null || !chatAccessService.isConversationAccessible(user, requestId)) {
            session.close(CloseStatus.POLICY_VIOLATION);
            return;
        }
        chatEventService.addSession(session, requestId);
        session.sendMessage(new TextMessage(CONNECTED));
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        Long requestId = requestIdFrom(session);
        User user = authenticatedUser(session);
        if (requestId == null || user == null || !chatAccessService.isConversationAccessible(user, requestId)) {
            session.close(CloseStatus.POLICY_VIOLATION);
            return;
        }
        JsonNode node;
        try {
            node = objectMapper.readTree(message.getPayload());
        } catch (Exception e) {
            sendError(session, "JSON invalide");
            return;
        }
        String type = node.path("type").asText("");
        if ("message".equals(type)) {
            handleIncomingMessage(session, requestId, user, node);
        } else if ("read".equals(type)) {
            handleReadReceipt(session, requestId, user);
        } else {
            sendError(session, "Type inconnu : " + type);
        }
    }

    private void handleIncomingMessage(WebSocketSession session, Long requestId, User user, JsonNode node) throws Exception {
        ChatMessage chatMessage = new ChatMessage();
        chatMessage.setRequestId(requestId);
        chatMessage.setSenderUserId(user.getId());
        chatMessage.setText(node.path("text").asText(""));
        String imageUrl = node.hasNonNull("imageUrl") ? node.path("imageUrl").asText(null) : null;
        if (imageUrl != null && !imageUrl.isEmpty() && !imageUrl.startsWith("/uploads/")) {
            sendError(session, "imageUrl invalide");
            return;
        }
        chatMessage.setImageUrl(imageUrl);
        if (node.hasNonNull("devisAmount")) {
            chatMessage.setDevisAmount(node.path("devisAmount").decimalValue());
            chatMessage.setDevisStatus("pending");
        }
        if (node.hasNonNull("scheduleAt")) {
            chatMessage.setScheduleAt(LocalDateTime.parse(node.path("scheduleAt").asText()));
            chatMessage.setScheduleStatus("pending");
        }
        chatMessage.setTimestamp(LocalDateTime.now());
        chatMessage.setRead(false);
        try {
            chatController.saveMessageBroadcast(chatMessage);
        } catch (IllegalArgumentException e) {
            sendError(session, e.getMessage());
        }
    }

    private void handleReadReceipt(WebSocketSession session, Long requestId, User user) throws Exception {
        chatController.markReadAndBroadcast(requestId, user.getId());
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        chatEventService.removeSession(session);
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) throws Exception {
        logger.warn("WebSocket transport error", exception);
        if (session.isOpen()) {
            session.close(CloseStatus.SERVER_ERROR);
        }
        chatEventService.removeSession(session);
    }

    private User authenticatedUser(WebSocketSession session) {
        java.security.Principal principal = session.getPrincipal();
        if (principal instanceof UsernamePasswordAuthenticationToken token
                && token.getPrincipal() instanceof User user) {
            return user;
        }
        return null;
    }

    private Long requestIdFrom(WebSocketSession session) {
        if (session.getUri() == null) {
            return null;
        }
        String path = session.getUri().getPath();
        int idx = path.lastIndexOf('/');
        if (idx < 0 || idx == path.length() - 1) {
            return null;
        }
        try {
            return Long.parseLong(path.substring(idx + 1));
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private void sendError(WebSocketSession session, String message) throws Exception {
        if (session.isOpen()) {
            session.sendMessage(new TextMessage(objectMapper.writeValueAsString(Map.of("type", "error", "message", message))));
        }
    }
}
