package com.mboatech.backend.service;

import com.mboatech.backend.model.Notification;
import com.mboatech.backend.repository.NotificationRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class NotificationService {

    private final NotificationRepository notificationRepository;

    public NotificationService(NotificationRepository notificationRepository) {
        this.notificationRepository = notificationRepository;
    }

    @Transactional
    public Notification create(Long userId, String title, String message, String type) {
        return create(userId, title, message, type, null);
    }

    @Transactional
    public Notification create(Long userId, String title, String message, String type, Long requestId) {
        if (userId == null || title == null || title.isBlank()) {
            return null;
        }
        Notification notification = new Notification();
        notification.setUserId(userId);
        notification.setTitle(title);
        notification.setMessage(message);
        notification.setType(type);
        notification.setRequestId(requestId);
        notification.setRead(false);
        notification.setCreatedAt(LocalDateTime.now());
        return notificationRepository.save(notification);
    }

    public boolean hasRecentDuplicate(Long userId, String title, String message, java.time.Duration window) {
        if (userId == null || title == null || title.isBlank()) {
            return false;
        }
        return notificationRepository.existsRecentSimilar(userId, title, message, LocalDateTime.now().minus(window));
    }

    @Transactional(readOnly = true)
    public List<Notification> listForUser(Long userId) {
        return notificationRepository.findByUserIdOrderByCreatedAtDesc(userId);
    }

    @Transactional(readOnly = true)
    public long unreadCount(Long userId) {
        return notificationRepository.countByUserIdAndIsReadFalse(userId);
    }

    @Transactional
    public boolean markRead(Long userId, Long id) {
        return notificationRepository.findById(id)
                .filter(notification -> notification.getUserId().equals(userId))
                .map(notification -> {
                    notification.setRead(true);
                    notificationRepository.save(notification);
                    return true;
                })
                .orElse(false);
    }

    @Transactional
    public void markAllRead(Long userId) {
        notificationRepository.markAllRead(userId);
    }

    @Transactional
    public void clearAll(Long userId) {
        notificationRepository.deleteByUserId(userId);
    }
}
