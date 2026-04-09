import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DigitalFileDownload } from "@/components/digital-file-download";

const mockDownloadFreeFile = vi.fn();
const mockRedeemCouponAndDownload = vi.fn();
const mockRegenerateCouponCode = vi.fn();

vi.mock("@/app/marketplace/digital-file-actions", () => ({
  downloadFreeFile: (...args: unknown[]) => mockDownloadFreeFile(...args),
  redeemCouponAndDownload: (...args: unknown[]) => mockRedeemCouponAndDownload(...args),
  regenerateCouponCode: (...args: unknown[]) => mockRegenerateCouponCode(...args),
}));

const baseProps = {
  marketplacePostId: "mp-1",
  fileName: "design-template.zip",
  fileSize: 5 * 1024 * 1024,
  isFree: true,
  isOwner: false,
};

describe("DigitalFileDownload", () => {
  beforeEach(() => vi.clearAllMocks());

  /* ── Rendering ────────────────────────────────────── */

  it("renders the digital file section", () => {
    render(<DigitalFileDownload {...baseProps} />);
    expect(screen.getByTestId("digital-file-section")).toBeInTheDocument();
  });

  it("displays file name and size", () => {
    render(<DigitalFileDownload {...baseProps} />);
    expect(screen.getByText(/design-template\.zip/)).toBeInTheDocument();
    expect(screen.getByText(/5\.0 MB/)).toBeInTheDocument();
  });

  it("shows Free badge for free files", () => {
    render(<DigitalFileDownload {...baseProps} />);
    expect(screen.getByText("Free")).toBeInTheDocument();
  });

  it("shows Coupon required badge for locked files", () => {
    render(<DigitalFileDownload {...baseProps} isFree={false} />);
    expect(screen.getByText("Coupon required")).toBeInTheDocument();
  });

  /* ── Non-owner: free download ─────────────────────── */

  it("shows download button for non-owner on free files", () => {
    render(<DigitalFileDownload {...baseProps} />);
    expect(screen.getByTestId("free-download-button")).toBeInTheDocument();
  });

  it("triggers download on button click", async () => {
    mockDownloadFreeFile.mockResolvedValueOnce({
      success: true,
      message: "Download ready",
      downloadUrl: "https://blob.example.com/file.zip",
      fileName: "design-template.zip",
    });

    render(<DigitalFileDownload {...baseProps} />);
    await userEvent.click(screen.getByTestId("free-download-button"));

    expect(mockDownloadFreeFile).toHaveBeenCalledWith("mp-1");
  });

  it("shows error on download failure", async () => {
    mockDownloadFreeFile.mockResolvedValueOnce({
      success: false,
      message: "Not authenticated",
    });

    render(<DigitalFileDownload {...baseProps} />);
    await userEvent.click(screen.getByTestId("free-download-button"));

    expect(screen.getByTestId("digital-file-error")).toHaveTextContent("Not authenticated");
  });

  /* ── Non-owner: coupon-locked download ────────────── */

  it("shows coupon input for non-owner on locked files", () => {
    render(<DigitalFileDownload {...baseProps} isFree={false} />);
    expect(screen.getByTestId("coupon-input")).toBeInTheDocument();
    expect(screen.getByTestId("redeem-coupon-button")).toBeInTheDocument();
  });

  it("does not show download button for locked files", () => {
    render(<DigitalFileDownload {...baseProps} isFree={false} />);
    expect(screen.queryByTestId("free-download-button")).not.toBeInTheDocument();
  });

  it("validates empty coupon before submission", async () => {
    render(<DigitalFileDownload {...baseProps} isFree={false} />);
    await userEvent.click(screen.getByTestId("redeem-coupon-button"));

    expect(screen.getByTestId("digital-file-error")).toHaveTextContent("Please enter a coupon code");
    expect(mockRedeemCouponAndDownload).not.toHaveBeenCalled();
  });

  it("redeems valid coupon and triggers download", async () => {
    mockRedeemCouponAndDownload.mockResolvedValueOnce({
      success: true,
      message: "Coupon redeemed",
      downloadUrl: "https://blob.example.com/file.zip",
      fileName: "design-template.zip",
    });

    render(<DigitalFileDownload {...baseProps} isFree={false} />);
    await userEvent.type(screen.getByTestId("coupon-input"), "ABCDEF123456");
    await userEvent.click(screen.getByTestId("redeem-coupon-button"));

    expect(mockRedeemCouponAndDownload).toHaveBeenCalledWith("mp-1", "ABCDEF123456");
  });

  it("shows error for invalid coupon", async () => {
    mockRedeemCouponAndDownload.mockResolvedValueOnce({
      success: false,
      message: "Invalid coupon code",
    });

    render(<DigitalFileDownload {...baseProps} isFree={false} />);
    await userEvent.type(screen.getByTestId("coupon-input"), "WRONGCODE");
    await userEvent.click(screen.getByTestId("redeem-coupon-button"));

    expect(screen.getByTestId("digital-file-error")).toHaveTextContent("Invalid coupon code");
  });

  /* ── Owner view: free file ────────────────────────── */

  it("shows download count and download button for owner of free file", () => {
    render(
      <DigitalFileDownload {...baseProps} isOwner downloadCount={42} />,
    );
    expect(screen.getByText("Downloads: 42")).toBeInTheDocument();
    expect(screen.getByTestId("owner-free-download-button")).toBeInTheDocument();
  });

  it("allows owner to download their own free file", async () => {
    mockDownloadFreeFile.mockResolvedValueOnce({
      success: true,
      message: "Download ready",
      downloadUrl: "https://blob.example.com/file.zip",
      fileName: "design-template.zip",
    });

    render(
      <DigitalFileDownload {...baseProps} isOwner downloadCount={5} />,
    );
    await userEvent.click(screen.getByTestId("owner-free-download-button"));

    expect(mockDownloadFreeFile).toHaveBeenCalledWith("mp-1");
  });

  /* ── Owner view: locked file ──────────────────────── */

  it("shows coupon code and management for owner of locked file", () => {
    render(
      <DigitalFileDownload
        {...baseProps}
        isFree={false}
        isOwner
        couponCode="ABC123DEF456"
        downloadCount={7}
      />,
    );
    expect(screen.getByTestId("owner-coupon-code")).toHaveTextContent("ABC123DEF456");
    expect(screen.getByTestId("copy-coupon-button")).toBeInTheDocument();
    expect(screen.getByTestId("regenerate-coupon-button")).toBeInTheDocument();
    expect(screen.getByText("Downloads: 7")).toBeInTheDocument();
  });

  it("does not show coupon input for owner", () => {
    render(
      <DigitalFileDownload
        {...baseProps}
        isFree={false}
        isOwner
        couponCode="ABC123"
      />,
    );
    expect(screen.queryByTestId("coupon-input")).not.toBeInTheDocument();
    expect(screen.queryByTestId("redeem-coupon-button")).not.toBeInTheDocument();
  });

  it("regenerates coupon code on button click", async () => {
    mockRegenerateCouponCode.mockResolvedValueOnce({
      success: true,
      message: "Coupon code regenerated",
      couponCode: "NEWCODE789ABC",
    });

    render(
      <DigitalFileDownload
        {...baseProps}
        isFree={false}
        isOwner
        couponCode="OLDCODE123456"
      />,
    );

    await userEvent.click(screen.getByTestId("regenerate-coupon-button"));

    expect(mockRegenerateCouponCode).toHaveBeenCalledWith("mp-1");
    expect(screen.getByTestId("owner-coupon-code")).toHaveTextContent("NEWCODE789ABC");
  });

  it("copies coupon code to clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(
      <DigitalFileDownload
        {...baseProps}
        isFree={false}
        isOwner
        couponCode="COPYTEST123"
      />,
    );

    await userEvent.click(screen.getByTestId("copy-coupon-button"));
    expect(writeText).toHaveBeenCalledWith("COPYTEST123");
  });

  /* ── File size formatting ─────────────────────────── */

  it("formats bytes correctly", () => {
    render(<DigitalFileDownload {...baseProps} fileSize={500} />);
    expect(screen.getByText(/500 B/)).toBeInTheDocument();
  });

  it("formats KB correctly", () => {
    render(<DigitalFileDownload {...baseProps} fileSize={2048} />);
    expect(screen.getByText(/2\.0 KB/)).toBeInTheDocument();
  });

  it("formats GB correctly", () => {
    render(
      <DigitalFileDownload {...baseProps} fileSize={1.5 * 1024 * 1024 * 1024} />,
    );
    expect(screen.getByText(/1\.5 GB/)).toBeInTheDocument();
  });
});
