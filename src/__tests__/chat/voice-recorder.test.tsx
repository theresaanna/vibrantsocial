import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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

  it("shows remaining time indicator", async () => {
    const mockStream = { getTracks: () => [{ stop: vi.fn() }] };
    mockGetUserMedia.mockResolvedValueOnce(mockStream);

    await act(async () => {
      render(
        <VoiceRecorder
          onRecordingComplete={vi.fn()}
          onCancel={vi.fn()}
          maxDuration={20}
        />
      );
    });

    expect(screen.getByTestId("recording-remaining")).toBeInTheDocument();
    expect(screen.getByTestId("recording-remaining")).toHaveTextContent("20s left");
  });

  it("uses default max duration from limits config", async () => {
    const mockStream = { getTracks: () => [{ stop: vi.fn() }] };
    mockGetUserMedia.mockResolvedValueOnce(mockStream);

    await act(async () => {
      render(
        <VoiceRecorder onRecordingComplete={vi.fn()} onCancel={vi.fn()} />
      );
    });

    // Default is 20s from DEFAULT_LIMITS
    expect(screen.getByTestId("recording-remaining")).toHaveTextContent("20s left");
  });
});

describe("VoiceRecorder duration cap", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("auto-stops recording when max duration is reached", async () => {
    const mockStream = { getTracks: () => [{ stop: vi.fn() }] };
    mockGetUserMedia.mockResolvedValueOnce(mockStream);
    const onComplete = vi.fn();

    await act(async () => {
      render(
        <VoiceRecorder
          onRecordingComplete={onComplete}
          onCancel={vi.fn()}
          maxDuration={3}
        />
      );
    });

    // Advance timer to reach maxDuration
    for (let i = 0; i < 3; i++) {
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });
    }

    expect(onComplete).toHaveBeenCalledWith(expect.any(Blob), expect.any(Number));
  });

  it("remaining time decreases as recording progresses", async () => {
    const mockStream = { getTracks: () => [{ stop: vi.fn() }] };
    mockGetUserMedia.mockResolvedValueOnce(mockStream);

    await act(async () => {
      render(
        <VoiceRecorder
          onRecordingComplete={vi.fn()}
          onCancel={vi.fn()}
          maxDuration={20}
        />
      );
    });

    // Advance 5 seconds
    for (let i = 0; i < 5; i++) {
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });
    }

    expect(screen.getByTestId("recording-remaining")).toHaveTextContent("15s left");
  });

  it("does not auto-stop before max duration", async () => {
    const mockStream = { getTracks: () => [{ stop: vi.fn() }] };
    mockGetUserMedia.mockResolvedValueOnce(mockStream);
    const onComplete = vi.fn();

    await act(async () => {
      render(
        <VoiceRecorder
          onRecordingComplete={onComplete}
          onCancel={vi.fn()}
          maxDuration={10}
        />
      );
    });

    // Advance 5 seconds (halfway)
    for (let i = 0; i < 5; i++) {
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });
    }

    expect(onComplete).not.toHaveBeenCalled();
    expect(screen.getByTestId("recording-remaining")).toHaveTextContent("5s left");
  });

  it("accepts custom maxDuration prop", async () => {
    const mockStream = { getTracks: () => [{ stop: vi.fn() }] };
    mockGetUserMedia.mockResolvedValueOnce(mockStream);

    await act(async () => {
      render(
        <VoiceRecorder
          onRecordingComplete={vi.fn()}
          onCancel={vi.fn()}
          maxDuration={120}
        />
      );
    });

    expect(screen.getByTestId("recording-remaining")).toHaveTextContent("120s left");
  });
});
