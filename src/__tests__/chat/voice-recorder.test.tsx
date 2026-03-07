import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { VoiceRecorder } from "@/components/chat/voice-recorder";

// Mock MediaRecorder
class MockMediaRecorder {
  state = "recording";
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;

  static isTypeSupported = vi.fn().mockReturnValue(true);

  start = vi.fn();
  stop = vi.fn().mockImplementation(() => {
    this.state = "inactive";
    if (this.ondataavailable) {
      this.ondataavailable({ data: new Blob(["audio-data"], { type: "audio/webm" }) });
    }
    if (this.onstop) {
      this.onstop();
    }
  });
}

// Mock getUserMedia
const mockGetUserMedia = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  global.MediaRecorder = MockMediaRecorder as unknown as typeof MediaRecorder;
  Object.defineProperty(navigator, "mediaDevices", {
    value: { getUserMedia: mockGetUserMedia },
    writable: true,
    configurable: true,
  });
});

describe("VoiceRecorder", () => {
  it("renders recording UI when microphone access is granted", async () => {
    const mockStream = { getTracks: () => [{ stop: vi.fn() }] };
    mockGetUserMedia.mockResolvedValueOnce(mockStream);

    await act(async () => {
      render(<VoiceRecorder onRecordingComplete={vi.fn()} onCancel={vi.fn()} />);
    });

    expect(screen.getByTestId("voice-recorder")).toBeInTheDocument();
    expect(screen.getByTestId("recording-indicator")).toBeInTheDocument();
    expect(screen.getByTestId("recording-duration")).toBeInTheDocument();
    expect(screen.getByTestId("voice-stop")).toBeInTheDocument();
    expect(screen.getByTestId("voice-cancel")).toBeInTheDocument();
  });

  it("calls onRecordingComplete when stop is clicked", async () => {
    const mockStream = { getTracks: () => [{ stop: vi.fn() }] };
    mockGetUserMedia.mockResolvedValueOnce(mockStream);
    const onComplete = vi.fn();

    await act(async () => {
      render(<VoiceRecorder onRecordingComplete={onComplete} onCancel={vi.fn()} />);
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("voice-stop"));
    });

    expect(onComplete).toHaveBeenCalledWith(expect.any(Blob), expect.any(Number));
  });

  it("calls onCancel when cancel is clicked", async () => {
    const mockStream = { getTracks: () => [{ stop: vi.fn() }] };
    mockGetUserMedia.mockResolvedValueOnce(mockStream);
    const onCancel = vi.fn();

    await act(async () => {
      render(<VoiceRecorder onRecordingComplete={vi.fn()} onCancel={onCancel} />);
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("voice-cancel"));
    });

    expect(onCancel).toHaveBeenCalled();
  });

  it("shows error when microphone permission is denied", async () => {
    mockGetUserMedia.mockRejectedValueOnce(new Error("Permission denied"));

    await act(async () => {
      render(<VoiceRecorder onRecordingComplete={vi.fn()} onCancel={vi.fn()} />);
    });

    expect(screen.getByTestId("voice-error")).toBeInTheDocument();
    expect(screen.getByText("Microphone access denied")).toBeInTheDocument();
  });
});
