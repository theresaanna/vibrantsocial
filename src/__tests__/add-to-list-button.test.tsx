import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AddToListButton } from "@/components/add-to-list-button";

vi.mock("@/app/lists/actions", () => ({
  addUserToMultipleLists: vi.fn().mockResolvedValue({ success: true, message: "ok" }),
  createList: vi.fn(),
}));

// jsdom does not implement showModal/close on <dialog>
beforeEach(() => {
  HTMLDialogElement.prototype.showModal =
    HTMLDialogElement.prototype.showModal ??
    vi.fn(function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    });
  HTMLDialogElement.prototype.close =
    HTMLDialogElement.prototype.close ??
    vi.fn(function (this: HTMLDialogElement) {
      this.removeAttribute("open");
    });
});

const lists = [
  { id: "l1", name: "Tech", isMember: true },
  { id: "l2", name: "Friends", isMember: false },
];

describe("AddToListButton", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders the list icon button", () => {
    render(<AddToListButton targetUserId="u2" lists={lists} />);
    const btn = screen.getByRole("button", { name: "Add to list" });
    expect(btn).toBeInTheDocument();
  });

  it("opens modal when clicked", async () => {
    const user = userEvent.setup();
    render(<AddToListButton targetUserId="u2" lists={lists} />);

    await user.click(screen.getByRole("button", { name: "Add to list" }));

    expect(screen.getByText("Add to Lists")).toBeInTheDocument();
    expect(screen.getByText("Tech")).toBeInTheDocument();
    expect(screen.getByText("Friends")).toBeInTheDocument();
  });

  it("shows checkboxes with correct initial state", async () => {
    const user = userEvent.setup();
    render(<AddToListButton targetUserId="u2" lists={lists} />);

    await user.click(screen.getByRole("button", { name: "Add to list" }));

    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes).toHaveLength(2);
    expect(checkboxes[0]).toBeChecked(); // Tech - isMember: true
    expect(checkboxes[1]).not.toBeChecked(); // Friends - isMember: false
  });

  it("toggles checkbox on click", async () => {
    const user = userEvent.setup();
    render(<AddToListButton targetUserId="u2" lists={lists} />);

    await user.click(screen.getByRole("button", { name: "Add to list" }));

    const checkboxes = screen.getAllByRole("checkbox");
    await user.click(checkboxes[1]); // Toggle Friends on
    expect(checkboxes[1]).toBeChecked();

    await user.click(checkboxes[0]); // Toggle Tech off
    expect(checkboxes[0]).not.toBeChecked();
  });

  it("has Save and Cancel buttons", async () => {
    const user = userEvent.setup();
    render(<AddToListButton targetUserId="u2" lists={lists} />);

    await user.click(screen.getByRole("button", { name: "Add to list" }));

    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("has inline create list form", async () => {
    const user = userEvent.setup();
    render(<AddToListButton targetUserId="u2" lists={lists} />);

    await user.click(screen.getByRole("button", { name: "Add to list" }));

    expect(screen.getByPlaceholderText("New list name...")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create" })).toBeInTheDocument();
  });
});
