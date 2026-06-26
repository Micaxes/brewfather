import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Button } from "@/components/ui/button";

describe("Button", () => {
  it("renders its children as a button", () => {
    render(<Button>Brew</Button>);
    expect(screen.getByRole("button", { name: "Brew" })).toBeInTheDocument();
  });

  it("renders as a child element when asChild is set", () => {
    render(
      <Button asChild>
        <a href="/dashboard">Open</a>
      </Button>
    );
    const link = screen.getByRole("link", { name: "Open" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/dashboard");
  });
});
