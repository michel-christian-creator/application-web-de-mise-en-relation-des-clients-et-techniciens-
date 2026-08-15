package com.mboatech.backend.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.RejectedExecutionException;

/**
 * Diffusion des événements de chat, rendue asynchrone tout en préservant
 * l'ordre des messages par demande.
 *
 * Chaque demande dispose d'une file mono-thread : les envois sont soumis dans
 * l'ordre d'arrivée et traités séquentiellement, donc deux messages consécutifs
 * ne peuvent jamais être livrés inversés. L'envoi lui-même n'occupe plus le
 * thread de la requête HTTP/WebSocket qui a produit l'événement.
 */
@Service
public class ChatEventService {

    private static final Logger logger = LoggerFactory.getLogger(ChatEventService.class);
    private final Map<SseEmitter, Long> emitters = new ConcurrentHashMap<>();
    private final Map<WebSocketSession, Long> wsSessions = new ConcurrentHashMap<>();
    private final Map<Long, ExecutorService> requestQueues = new ConcurrentHashMap<>();
    private final ObjectMapper objectMapper;

    public ChatEventService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public SseEmitter createEmitter(Long requestId) {
        SseEmitter emitter = new SseEmitter(300_000L); // 5 minutes, nettoyé automatiquement
        emitters.put(emitter, requestId);

        emitter.onCompletion(() -> {
            emitters.remove(emitter);
            maybeShutdownQueue(requestId);
        });
        emitter.onTimeout(() -> {
            emitters.remove(emitter);
            maybeShutdownQueue(requestId);
        });
        emitter.onError((e) -> {
            emitters.remove(emitter);
            maybeShutdownQueue(requestId);
        });

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
        Long requestId = wsSessions.remove(session);
        if (requestId != null) {
            maybeShutdownQueue(requestId);
        }
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
        List<SseEmitter> targets = new ArrayList<>();
        emitters.forEach((emitter, targetRequestId) -> {
            if (requestId.equals(targetRequestId)) {
                targets.add(emitter);
            }
        });
        if (targets.isEmpty()) {
            return;
        }
        submitSend(requestId, () -> {
            for (SseEmitter emitter : targets) {
                try {
                    emitter.send(SseEmitter.event().name(eventName).data(payload));
                } catch (Exception e) {
                    logger.warn("Removing SSE emitter due to error", e);
                    emitters.remove(emitter);
                }
            }
        });
    }

    private void broadcastToWs(Long requestId, String json) {
        List<WebSocketSession> targets = new ArrayList<>();
        wsSessions.forEach((session, targetRequestId) -> {
            if (requestId.equals(targetRequestId)) {
                targets.add(session);
            }
        });
        if (targets.isEmpty()) {
            return;
        }
        submitSend(requestId, () -> {
            for (WebSocketSession session : targets) {
                try {
                    synchronized (session) {
                        if (session.isOpen()) {
                            session.sendMessage(new TextMessage(json));
                        }
                    }
                } catch (Exception e) {
                    logger.warn("Removing WebSocket session due to error", e);
                    wsSessions.remove(session);
                }
            }
        });
    }

    private void submitSend(Long requestId, Runnable task) {
        ExecutorService queue = requestQueues.computeIfAbsent(requestId, id -> Executors.newSingleThreadExecutor(r -> {
            Thread thread = new Thread(r, "chat-broadcast-" + id);
            thread.setDaemon(true);
            return thread;
        }));
        try {
            queue.execute(task);
        } catch (RejectedExecutionException e) {
            logger.warn("Chat broadcast queue fermée pour la demande {}", requestId);
        }
    }

    private void maybeShutdownQueue(Long requestId) {
        boolean idle = emitters.entrySet().stream().noneMatch(e -> requestId.equals(e.getValue()))
                && wsSessions.entrySet().stream().noneMatch(s -> requestId.equals(s.getValue()));
        if (idle) {
            ExecutorService queue = requestQueues.remove(requestId);
            if (queue != null) {
                queue.shutdown();
            }
        }
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
