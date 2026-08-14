package com.mboatech.backend.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class ChatEventService {

    private static final Logger logger = LoggerFactory.getLogger(ChatEventService.class);
    private final Map<SseEmitter, Long> emitters = new ConcurrentHashMap<>();
    private final Map<WebSocketSession, Long> wsSessions = new ConcurrentHashMap<>();
    private final ObjectMapper objectMapper;

    public ChatEventService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public SseEmitter createEmitter(Long requestId) {
        SseEmitter emitter = new SseEmitter(300_000L); // 5 minutes, nettoyé automatiquement
        emitters.put(emitter, requestId);

        emitter.onCompletion(() -> emitters.remove(emitter));
        emitter.onTimeout(() -> emitters.remove(emitter));
        emitter.onError((e) -> emitters.remove(emitter));

        try {
            emitter.send(SseEmitter.event().name("connected").data("connected"));
        } catch (Exception e) {
            logger.warn("Failed to send initial SSE event", e);
        }

        return emitter;
    }

    public void addSession(WebSocketSession session, Long requestId) {
        wsSessions.put(session, requestId);
    }

    public void removeSession(WebSocketSession session) {
        wsSessions.remove(session);
    }

    public void broadcastMessage(Long requestId, Object payload) {
        broadcastEvent(requestId, "message", payload);
        broadcastToWs(requestId, envelope(payload, "message"));
    }

    public void broadcastRead(Long requestId, Object payload) {
        broadcastEvent(requestId, "read", payload);
        broadcastToWs(requestId, envelope(payload, "read"));
    }

    public void broadcastDevis(Long requestId, Object payload) {
        broadcastEvent(requestId, "devis", payload);
        broadcastToWs(requestId, envelope(payload, "devis"));
    }

    public void broadcastSchedule(Long requestId, Object payload) {
        broadcastEvent(requestId, "schedule", payload);
        broadcastToWs(requestId, envelope(payload, "schedule"));
    }

    private void broadcastEvent(Long requestId, String eventName, Object payload) {
        emitters.entrySet().removeIf(entry -> {
            SseEmitter emitter = entry.getKey();
            Long targetRequestId = entry.getValue();
            if (!requestId.equals(targetRequestId)) {
                return false;
            }
            try {
                emitter.send(SseEmitter.event().name(eventName).data(payload));
                return false;
            } catch (Exception e) {
                logger.warn("Removing SSE emitter due to error", e);
                return true;
            }
        });
    }

    private void broadcastToWs(Long requestId, String json) {
        wsSessions.entrySet().removeIf(entry -> {
            WebSocketSession session = entry.getKey();
            Long targetRequestId = entry.getValue();
            if (!requestId.equals(targetRequestId)) {
                return false;
            }
            try {
                synchronized (session) {
                    if (session.isOpen()) {
                        session.sendMessage(new TextMessage(json));
                    }
                }
                return false;
            } catch (Exception e) {
                logger.warn("Removing WebSocket session due to error", e);
                return true;
            }
        });
    }

    private String envelope(Object payload, String type) {
        try {
            Map<String, Object> map = objectMapper.convertValue(payload, new TypeReference<LinkedHashMap<String, Object>>() {
            });
            map.put("type", type);
            return objectMapper.writeValueAsString(map);
        } catch (Exception e) {
            logger.warn("Failed to build WebSocket envelope", e);
            return "{\"type\":\"" + type + "\"}";
        }
    }
}
