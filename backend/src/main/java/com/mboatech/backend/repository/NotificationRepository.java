package com.mboatech.backend.repository;

import com.mboatech.backend.model.Notification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface NotificationRepository extends JpaRepository<Notification, Long> {
    List<Notification> findByUserIdOrderByCreatedAtDesc(Long userId);

    long countByUserIdAndIsReadFalse(Long userId);

    @Query("SELECT COUNT(n) > 0 FROM Notification n WHERE n.userId = :userId AND n.title = :title AND n.message = :message AND n.createdAt > :since")
    boolean existsRecentSimilar(@Param("userId") Long userId,
                                @Param("title") String title,
                                @Param("message") String message,
                                @Param("since") LocalDateTime since);

    @Modifying
    @Query("update Notification n set n.isRead = true where n.userId = :userId and n.isRead = false")
    int markAllRead(@Param("userId") Long userId);

    void deleteByUserId(Long userId);
}
