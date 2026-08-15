package com.mboatech.backend.service;

import com.mboatech.backend.model.ClientProfile;
import com.mboatech.backend.model.ClientRequest;
import com.mboatech.backend.model.Role;
import com.mboatech.backend.model.TechnicianProfile;
import com.mboatech.backend.model.User;
import com.mboatech.backend.repository.ClientProfileRepository;
import com.mboatech.backend.repository.ClientRequestRepository;
import com.mboatech.backend.repository.TechnicianProfileRepository;
import org.springframework.stereotype.Service;

import java.util.Optional;

/**
 * Règles d'accès aux conversations de chat : qui peut lire/écrire dans une
 * demande d'intervention. Partagé entre le contrôleur HTTP et le handler
 * WebSocket pour une application unique des règles.
 */
@Service
public class ChatAccessService {

    private final ClientRequestRepository requestRepository;
    private final ClientProfileRepository clientProfileRepository;
    private final TechnicianProfileRepository technicianProfileRepository;

    public ChatAccessService(ClientRequestRepository requestRepository,
                             ClientProfileRepository clientProfileRepository,
                             TechnicianProfileRepository technicianProfileRepository) {
        this.requestRepository = requestRepository;
        this.clientProfileRepository = clientProfileRepository;
        this.technicianProfileRepository = technicianProfileRepository;
    }

    public boolean isConversationAccessible(User user, Long requestId) {
        Optional<ClientRequest> optional = requestRepository.findById(requestId);
        if (optional.isEmpty()) {
            return false;
        }
        ClientRequest request = optional.get();
        if (user.getRole() == Role.admin) {
            return true;
        }
        if ("published".equals(request.getStatus())) {
            return user.getRole() == Role.technician;
        }
        Long clientProfileId = clientProfileRepository.findByUserId(user.getId())
                .map(ClientProfile::getId)
                .orElse(null);
        if (clientProfileId != null && clientProfileId.equals(request.getClientId())) {
            return true;
        }
        return technicianProfileRepository.findByUserId(user.getId())
                .map(TechnicianProfile::getId)
                .map(id -> id.equals(request.getTechnicianId()))
                .orElse(false);
    }

    public boolean isRequestClient(User user, Long requestId) {
        Optional<ClientRequest> optional = requestRepository.findById(requestId);
        if (optional.isEmpty()) {
            return false;
        }
        ClientRequest request = optional.get();
        if (user.getRole() == Role.admin) {
            return true;
        }
        Long clientProfileId = clientProfileRepository.findByUserId(user.getId())
                .map(ClientProfile::getId)
                .orElse(null);
        return clientProfileId != null && clientProfileId.equals(request.getClientId());
    }
}
