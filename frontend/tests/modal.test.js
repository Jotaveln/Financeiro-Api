import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Modal } from "@/components/modal";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("Modal", () => {
  it("foca o botão de fechar e fecha com Escape", () => {
    const onClose = vi.fn();
    render(React.createElement(React.Fragment, null,
      React.createElement("button", { type: "button" }, "Abrir"),
      React.createElement(Modal, { open: true, title: "Detalhes", onClose }, React.createElement("button", { type: "button" }, "Ação"))
    ));
    expect(screen.getByRole("button", { name: "Fechar" })).toHaveFocus();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("devolve o foco ao acionador depois que o modal fecha", () => {
    function Harness() {
      const [open, setOpen] = React.useState(false);
      return React.createElement(React.Fragment, null,
        React.createElement("button", { type: "button", onClick: () => setOpen(true) }, "Abrir"),
        React.createElement(Modal, { open, title: "Detalhes", onClose: () => setOpen(false) })
      );
    }

    render(React.createElement(Harness));
    const opener = screen.getByRole("button", { name: "Abrir" });
    opener.focus();
    fireEvent.click(opener);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(opener).toHaveFocus();
  });

  it("mantém Tab e Shift+Tab dentro do diálogo", () => {
    const { rerender } = render(React.createElement(React.Fragment, null,
      React.createElement("button", { type: "button" }, "Abrir"),
      React.createElement(Modal, { open: true, title: "Detalhes", onClose: vi.fn() }, React.createElement("button", { type: "button" }, "Ação"))
    ));
    const close = screen.getByRole("button", { name: "Fechar" });
    const action = screen.getByRole("button", { name: "Ação" });

    action.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(close).toHaveFocus();

    close.focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(action).toHaveFocus();

    rerender(React.createElement(React.Fragment, null,
      React.createElement("button", { type: "button" }, "Abrir"),
      React.createElement(Modal, { open: false, title: "Detalhes", onClose: vi.fn() })
    ));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
