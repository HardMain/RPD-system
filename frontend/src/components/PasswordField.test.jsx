import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PasswordField } from "./PasswordField.jsx";

describe("PasswordField", () => {
  it("по умолчанию скрывает пароль", () => {
    const { container } = render(<PasswordField label="Пароль" value="secret" onChange={() => {}} />);
    expect(container.querySelector("input").type).toBe("password");
  });

  it("переключает видимость по кнопке-глазу", async () => {
    const user = userEvent.setup();
    const { container } = render(<PasswordField label="Пароль" value="secret" onChange={() => {}} />);
    const input = container.querySelector("input");
    expect(input.type).toBe("password");

    await user.click(screen.getByTitle("Показать пароль"));
    expect(input.type).toBe("text");

    await user.click(screen.getByTitle("Скрыть пароль"));
    expect(input.type).toBe("password");
  });
});
