import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MediaRenderer } from "@/components/chat/media-renderer";

describe("MediaRenderer NSFW overlay", () => {
  it("shows overlay for NSFW image", () => {
    render(
      <MediaRenderer
        mediaUrl="https://example.com/photo.jpg"
        mediaType="image"
        mediaFileName="photo.jpg"
        mediaFileSize={500000}
        isOwn={false}
        isNsfw={true}
      />
    );
    expect(screen.getByText("Sensitive content")).toBeInTheDocument();
    expect(screen.getByText("Click to view")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("shows overlay for NSFW video", () => {
    const { container } = render(
      <MediaRenderer
        mediaUrl="https://example.com/video.mp4"
        mediaType="video"
        mediaFileName="video.mp4"
        mediaFileSize={5000000}
        isOwn={false}
        isNsfw={true}
      />
    );
    expect(screen.getByText("Sensitive content")).toBeInTheDocument();
    expect(container.querySelector("video")).not.toBeInTheDocument();
  });

  it("reveals image after clicking overlay button", () => {
    render(
      <MediaRenderer
        mediaUrl="https://example.com/photo.jpg"
        mediaType="image"
        mediaFileName="photo.jpg"
        mediaFileSize={500000}
        isOwn={false}
        isNsfw={true}
      />
    );

    fireEvent.click(screen.getByText("Click to view"));

    expect(screen.queryByText("Sensitive content")).not.toBeInTheDocument();
    expect(screen.getByRole("img")).toHaveAttribute("src", "https://example.com/photo.jpg");
  });

  it("reveals video after clicking overlay button", () => {
    const { container } = render(
      <MediaRenderer
        mediaUrl="https://example.com/video.mp4"
        mediaType="video"
        mediaFileName="video.mp4"
        mediaFileSize={5000000}
        isOwn={false}
        isNsfw={true}
      />
    );

    fireEvent.click(screen.getByText("Click to view"));

    expect(screen.queryByText("Sensitive content")).not.toBeInTheDocument();
    expect(container.querySelector("video")).toBeInTheDocument();
  });

  it("does NOT show overlay for NSFW audio (audio is not visual)", () => {
    const { container } = render(
      <MediaRenderer
        mediaUrl="https://example.com/audio.webm"
        mediaType="audio"
        mediaFileName="audio.webm"
        mediaFileSize={1000000}
        isOwn={false}
        isNsfw={true}
      />
    );
    expect(screen.queryByText("Sensitive content")).not.toBeInTheDocument();
    expect(container.querySelector("audio")).toBeInTheDocument();
  });

  it("does NOT show overlay for NSFW document", () => {
    render(
      <MediaRenderer
        mediaUrl="https://example.com/doc.pdf"
        mediaType="document"
        mediaFileName="doc.pdf"
        mediaFileSize={100000}
        isOwn={false}
        isNsfw={true}
      />
    );
    expect(screen.queryByText("Sensitive content")).not.toBeInTheDocument();
    expect(screen.getByText("doc.pdf")).toBeInTheDocument();
  });

  it("does NOT show overlay when isNsfw is false", () => {
    render(
      <MediaRenderer
        mediaUrl="https://example.com/photo.jpg"
        mediaType="image"
        mediaFileName="photo.jpg"
        mediaFileSize={500000}
        isOwn={false}
        isNsfw={false}
      />
    );
    expect(screen.queryByText("Sensitive content")).not.toBeInTheDocument();
    expect(screen.getByRole("img")).toBeInTheDocument();
  });

  it("does NOT show overlay when isNsfw is undefined (default)", () => {
    render(
      <MediaRenderer
        mediaUrl="https://example.com/photo.jpg"
        mediaType="image"
        mediaFileName="photo.jpg"
        mediaFileSize={500000}
        isOwn={false}
      />
    );
    expect(screen.queryByText("Sensitive content")).not.toBeInTheDocument();
    expect(screen.getByRole("img")).toBeInTheDocument();
  });
});
