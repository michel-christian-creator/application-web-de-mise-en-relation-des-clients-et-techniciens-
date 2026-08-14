package com.mboatech.backend.controller;

import com.mboatech.backend.model.ClientProfile;
import com.mboatech.backend.model.User;
import com.mboatech.backend.repository.ChatMessageRepository;
import com.mboatech.backend.repository.ClientProfileRepository;
import com.mboatech.backend.repository.ClientRequestRepository;
import com.mboatech.backend.repository.RequestDeclineRepository;
import com.mboatech.backend.repository.TechnicianProfileRepository;
import com.mboatech.backend.repository.UserRepository;
import com.mboatech.backend.service.ChatEventService;
import com.mboatech.backend.service.MissionGuardService;
import com.mboatech.backend.service.NotificationService;
import com.mboatech.backend.service.TechnicianEventService;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ChatControllerTest {

    @Test
    void resolveClientIdUsesClientProfileWhenAuthenticatedUserIsProvided() {
        ClientRequestRepository requestRepository = mock(ClientRequestRepository.class);
        ChatMessageRepository messageRepository = mock(ChatMessageRepository.class);
        UserRepository userRepository = mock(UserRepository.class);
        ClientProfileRepository clientProfileRepository = mock(ClientProfileRepository.class);
        TechnicianProfileRepository technicianProfileRepository = mock(TechnicianProfileRepository.class);
        RequestDeclineRepository requestDeclineRepository = mock(RequestDeclineRepository.class);
        ChatEventService chatEventService = mock(ChatEventService.class);
        TechnicianEventService technicianEventService = mock(TechnicianEventService.class);
        NotificationService notificationService = mock(NotificationService.class);
        MissionGuardService missionGuardService = mock(MissionGuardService.class);

        ChatController controller = new ChatController(
                requestRepository,
                messageRepository,
                userRepository,
                clientProfileRepository,
                technicianProfileRepository,
                requestDeclineRepository,
                chatEventService,
                technicianEventService,
                notificationService,
                missionGuardService
        );

        User user = new User();
        user.setId(7L);

        ClientProfile clientProfile = new ClientProfile();
        clientProfile.setId(42L);
        clientProfile.setUser(user);

        when(clientProfileRepository.findByUserId(7L)).thenReturn(Optional.of(clientProfile));

        Long resolvedClientId = controller.resolveClientId(user);

        assertEquals(42L, resolvedClientId);
    }
}
