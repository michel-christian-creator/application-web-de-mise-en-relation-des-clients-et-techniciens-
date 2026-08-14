package com.mboatech.backend.repository;

import com.mboatech.backend.model.ChatMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {
    List<ChatMessage> findByRequestIdOrderByTimestampAsc(Long requestId);

    ChatMessage findTopByRequestIdOrderByTimestampDesc(Long requestId);

    @Query("SELECT COUNT(m) FROM ChatMessage m WHERE m.requestId IN :requestIds AND m.senderUserId <> :userId AND m.isRead = false")
    long countUnreadByRequestIds(@Param("requestIds") List<Long> requestIds, @Param("userId") Long userId);

    @Query("SELECT COUNT(m) FROM ChatMessage m WHERE m.requestId = :requestId AND m.senderUserId <> :userId AND m.isRead = false")
    long countUnreadByRequest(@Param("requestId") Long requestId, @Param("userId") Long userId);

    @Modifying
    @Query("UPDATE ChatMessage m SET m.isRead = true WHERE m.requestId = :requestId AND m.senderUserId <> :userId AND m.isRead = false")
    int markAllReadByRequest(@Param("requestId") Long requestId, @Param("userId") Long userId);

    @Query("SELECT m.id FROM ChatMessage m WHERE m.requestId = :requestId AND m.senderUserId <> :userId AND m.isRead = false")
    List<Long> findUnreadIdsByRequest(@Param("requestId") Long requestId, @Param("userId") Long userId);

    @Modifying
    @Query("UPDATE ChatMessage m SET m.devisStatus = :status WHERE m.id = :id")
    int updateDevisStatus(@Param("id") Long id, @Param("status") String status);

    @Modifying
    @Query("UPDATE ChatMessage m SET m.devisStatus = :status WHERE m.requestId = :requestId AND m.devisStatus = 'accepted'")
    int releaseAcceptedDevis(@Param("requestId") Long requestId, @Param("status") String status);
}
