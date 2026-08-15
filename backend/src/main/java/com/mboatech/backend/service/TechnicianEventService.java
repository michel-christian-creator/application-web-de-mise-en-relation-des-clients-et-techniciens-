package com.mboatech.backend.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

@Service
public class TechnicianEventService {

    private static final Logger logger = LoggerFactory.getLogger(TechnicianEventService.class);
    private final List<SseEmitter> emitters = new CopyOnWriteArrayList<>();
    private final ThreadPoolTaskExecutor broadcastExecutor;

    public TechnicianEventService(@Qualifier("broadcastTaskExecutor") ThreadPoolTaskExecutor broadcastExecutor) {
        this.broadcastExecutor = broadcastExecutor;
    }

    public SseEmitter createEmitter() {
        SseEmitter emitter = new SseEmitter(300_000L); // 5 minutes, nettoyé automatiquement
        this.emitters.add(emitter);

        emitter.onCompletion(() -> this.emitters.remove(emitter));
        emitter.onTimeout(() -> this.emitters.remove(emitter));
        emitter.onError((e) -> this.emitters.remove(emitter));

        try {
            emitter.send(SseEmitter.event().name("connected").data("connected"));
        } catch (Exception e) {
            logger.warn("Failed to send initial SSE event", e);
        }

        return emitter;
    }

    public void broadcast(String eventName, Object payload) {
        List<SseEmitter> snapshot = new ArrayList<>(emitters);
        for (SseEmitter emitter : snapshot) {
            try {
                broadcastExecutor.execute(() -> sendToEmitter(emitter, eventName, payload));
            } catch (Exception e) {
                logger.warn("Broadcast interrompu : {}", e.getMessage());
                emitters.remove(emitter);
            }
        }
    }

    private void sendToEmitter(SseEmitter emitter, String eventName, Object payload) {
        try {
            emitter.send(SseEmitter.event().name(eventName).data(payload));
        } catch (Exception e) {
            logger.warn("Removing stale SSE emitter: {}", e.getMessage());
            emitters.remove(emitter);
        }
    }
}
