package com.mboatech.backend.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.ThreadPoolExecutor;

/**
 * Exécuteur dédié aux diffusions SSE/WebSocket.
 *
 * Le broadcast est lancé sur ce pool pour ne jamais bloquer le thread de la
 * requête HTTP à l'origine de l'événement : un client lent (buffer TCP plein)
 * ne retarde plus ni l'action en cours ni les autres abonnés.
 */
@Configuration
public class AsyncConfig {

    private static final Logger logger = LoggerFactory.getLogger(AsyncConfig.class);

    @Bean(name = "broadcastTaskExecutor")
    public ThreadPoolTaskExecutor broadcastTaskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(8);
        executor.setMaxPoolSize(32);
        executor.setQueueCapacity(512);
        executor.setThreadNamePrefix("sse-broadcast-");
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.DiscardPolicy() {
            @Override
            public void rejectedExecution(Runnable r, ThreadPoolExecutor e) {
                logger.warn("Broadcast rejeté : file saturée ({}/{})", e.getQueue().size(), e.getQueue().remainingCapacity() + e.getQueue().size());
            }
        });
        executor.initialize();
        return executor;
    }
}
