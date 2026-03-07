import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MediaRenderer } from "@/components/chat/media-renderer";

describe("MediaRenderer", () => {
  it("renders image with correct src", () => {
    render(
      <MediaRenderer
        mediaUrl="https://example.com/photo.jpg"
        mediaType="image"
        mediaFileName="photo.jpg"
        mediaFileSize={500000}
        isOwn={false}
      />
    );
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("src", "https://example.com/photo.jpg");
    expect(img).toHaveAttribute("alt", "photo.jpg");
  });

  it("renders video player with controls", () => {
    const { container } = render(
      <MediaRenderer
        mediaUrl="https://example.com/video.mp4"
        mediaType="video"
        mediaFileName="video.mp4"
        mediaFileSize={5000000}
        isOwn={false}
      />
    );
    const video = container.querySelector("video");
    expect(video).toBeInTheDocument();
    expect(video).toHaveAttribute("controls");
    expect(video).toHaveAttribute("src", "https://example.com/video.mp4");
  });

  it("renders audio player", () => {
    const { container } = render(
      <MediaRenderer
        mediaUrl="https://example.com/audio.webm"
        mediaType="audio"
        mediaFileName="audio.webm"
        mediaFileSize={1000000}
        isOwn={false}
      />
    );
    const audio = container.querySelector("audio");
    expect(audio).toBeInTheDocument();
    expect(audio).toHaveAttribute("controls");
    expect(audio).toHaveAttribute("src", "https://example.com/audio.webm");
  });

  it("renders document with filename and download link", () => {
    render(
      <MediaRenderer
        mediaUrl="https://example.com/report.pdf"
        mediaType="document"
        mediaFileName="report.pdf"
        mediaFileSize={2500000}
        isOwn={false}
      />
    );
    expect(screen.getByText("report.pdf")).toBeInTheDocument();
    expect(screen.getByText("2.4 MB")).toBeInTheDocument();
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "https://example.com/report.pdf");
  });

  it("renders document with default name when fileName is null", () => {
    render(
      <MediaRenderer
        mediaUrl="https://example.com/doc.pdf"
        mediaType="document"
        mediaFileName={null}
        mediaFileSize={null}
        isOwn={true}
      />
    );
    expect(screen.getByText("Document")).toBeInTheDocument();
  });
});
