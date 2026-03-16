import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { FramedAvatar } from "@/components/framed-avatar";

vi.mock("@/lib/profile-frames", () => ({
  getFrameById: (id: string | null | undefined) => {
    if (id === "spring-1")
      return { id: "spring-1", name: "Spring Bloom", src: "/frames/spring-1.svg", category: "spring" };
    if (id === "neon-1")
      return { id: "neon-1", name: "Neon Heart", src: "/frames/neon-1.svg", category: "neon" };
    return null;
  },
}));

describe("FramedAvatar", () => {
  it("renders avatar img when src is provided", () => {
    render(<FramedAvatar src="https://example.com/avatar.jpg" alt="User" size={40} />);
    const img = screen.getByAltText("User");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "https://example.com/avatar.jpg");
  });

  it("renders initial fallback when src is null", () => {
    render(<FramedAvatar src={null} initial="A" size={40} />);
    expect(screen.getByText("A")).toBeInTheDocument();
  });

  it("renders '?' when src is null and no initial provided", () => {
    render(<FramedAvatar src={null} size={40} />);
    expect(screen.getByText("?")).toBeInTheDocument();
  });

  it("renders frame overlay when frameId is valid", () => {
    const { container } = render(
      <FramedAvatar src="https://example.com/avatar.jpg" size={40} frameId="spring-1" />
    );
    const frameImg = container.querySelector('img[aria-hidden="true"]');
    expect(frameImg).toBeInTheDocument();
    expect(frameImg).toHaveAttribute("src", "/frames/spring-1.svg");
  });

  it("does not render frame when frameId is null", () => {
    const { container } = render(
      <FramedAvatar src="https://example.com/avatar.jpg" size={40} frameId={null} />
    );
    const frameImg = container.querySelector('img[aria-hidden="true"]');
    expect(frameImg).not.toBeInTheDocument();
  });

  it("does not render frame when frameId is invalid", () => {
    const { container } = render(
      <FramedAvatar src="https://example.com/avatar.jpg" size={40} frameId="invalid" />
    );
    const frameImg = container.querySelector('img[aria-hidden="true"]');
    expect(frameImg).not.toBeInTheDocument();
  });

  it("skips frame for size < 20", () => {
    const { container } = render(
      <FramedAvatar src="https://example.com/avatar.jpg" size={16} frameId="spring-1" />
    );
    const frameImg = container.querySelector('img[aria-hidden="true"]');
    expect(frameImg).not.toBeInTheDocument();
  });

  it("renders frame at size exactly 20", () => {
    const { container } = render(
      <FramedAvatar src="https://example.com/avatar.jpg" size={20} frameId="neon-1" />
    );
    const frameImg = container.querySelector('img[aria-hidden="true"]');
    expect(frameImg).toBeInTheDocument();
  });

  it("frame has pointer-events-none and aria-hidden", () => {
    const { container } = render(
      <FramedAvatar src="https://example.com/avatar.jpg" size={40} frameId="spring-1" />
    );
    const frameImg = container.querySelector('img[aria-hidden="true"]');
    expect(frameImg).toHaveClass("pointer-events-none");
    expect(frameImg).toHaveAttribute("aria-hidden", "true");
  });

  it("applies correct inline sizing", () => {
    const { container } = render(
      <FramedAvatar src="https://example.com/avatar.jpg" size={64} frameId="spring-1" />
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.style.width).toBe("64px");
    expect(wrapper.style.height).toBe("64px");

    const avatarImg = container.querySelector('img:not([aria-hidden])') as HTMLElement;
    expect(avatarImg.style.width).toBe("64px");
    expect(avatarImg.style.height).toBe("64px");

    const frameImg = container.querySelector('img[aria-hidden="true"]') as HTMLElement;
    // Frame scale is 1.35: 64 * 1.35 = 86.4
    expect(parseFloat(frameImg.style.width)).toBeCloseTo(86.4);
    expect(parseFloat(frameImg.style.height)).toBeCloseTo(86.4);
    // Centered via transform
    expect(frameImg.style.top).toBe("50%");
    expect(frameImg.style.left).toBe("50%");
    expect(frameImg.style.transform).toBe("translate(-50%, -50%)");
  });

  it("applies custom className", () => {
    const { container } = render(
      <FramedAvatar src={null} initial="B" size={32} className="my-custom-class" />
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain("my-custom-class");
  });
});
