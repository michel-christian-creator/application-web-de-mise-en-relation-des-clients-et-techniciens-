package com.mboatech.backend.config;

import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.context.request.async.AsyncRequestTimeoutException;

/**
 * Les flux SSE (catalogue, chat, notifications) expirent régulièrement quand
 * aucun événement n'est émis pendant la fenêtre du SseEmitter. Cette expiration
 * lève une AsyncRequestTimeoutException qui est bénigne (la connexion se
 * referme proprement et le client se reconnecte). On la neutralise ici pour
 * éviter de polluer les logs backend avec des WARN récurrents.
 */
@ControllerAdvice
public class AsyncRequestTimeoutAdvice {

    @ExceptionHandler(AsyncRequestTimeoutException.class)
    public void handleAsyncRequestTimeout(AsyncRequestTimeoutException ex) {
        // Volontairement vide : le timeout SSE est attendu et sans impact.
    }
}
