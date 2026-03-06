import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MessageRequestCard } from "@/components/chat/message-request-card";
import type { MessageRequestData } from "@/types/chat";

vi.mock("@/app/chat/actions", () => ({
  acceptMessageRequest: vi.fn().mockResolvedValue({ success: true, conversationId: "conv1" }),
  declineMessageRequest: vi.fn().mockResolvedValue({ success: true, message: "Request declined" }),
}));

vi.mock("next/navigation", () => ({
  useRouter: vi.fn().mockReturnValue({ push: vi.fn() }),
}));

const mockRequest: MessageRequestData = {
  id: "req1",
  senderId: "sender1",
  status: "PENDING",
  createdAt: new Date(),
  sender: {
    id: "sender1",
    username: "alice",
    displayName: "Alice",
    name: "Alice",
    avatar: null,
    image: null,
  },
};

describe("MessageRequestCard", () => {
  it("renders sender info", () => {
    render(<MessageRequestCard request={mockRequest} />);
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("@alice")).toBeInTheDocument();
    expect(screen.getByText("wants to message you")).toBeInTheDocument();
  });

  it("renders accept button", () => {
    render(<MessageRequestCard request={mockRequest} />);
    expect(screen.getByText("Accept")).toBeInTheDocument();
  });

  it("renders decline button", () => {
    render(<MessageRequestCard request={mockRequest} />);
    expect(screen.getByText("Decline")).toBeInTheDocument();
  });

  it("shows sender initials when no avatar", () => {
    render(<MessageRequestCard request={mockRequest} />);
    expect(screen.getByText("A")).toBeInTheDocument();
  });
});
