import { describe, it, expect, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useRowEditor } from "./useRowEditor.jsx";

function setup(overrides = {}) {
  const add = vi.fn(() => Promise.resolve());
  const update = vi.fn(() => Promise.resolve());
  const remove = vi.fn(() => Promise.resolve());
  const reload = vi.fn(() => Promise.resolve());
  const items = overrides.items ?? [
    { id: 1, name: "" },
    { id: 2, name: "заполнено" },
  ];
  const opts = {
    items,
    editable: true,
    reload,
    idKey: "id",
    add,
    update,
    remove,
    isFilled: it => !!it.name,
    ...overrides,
  };
  const view = renderHook(() => useRowEditor(opts));
  return { view, add, update, remove, reload, items };
}

describe("useRowEditor", () => {
  it("addRow вызывает add и reload", async () => {
    const { view, add, reload } = setup();
    await act(async () => { await view.result.current.addRow(); });
    expect(add).toHaveBeenCalledTimes(1);
    expect(reload).toHaveBeenCalled();
  });

  it("saveRow прокидывает item и patch в update, затем reload", async () => {
    const { view, update, reload, items } = setup();
    await act(async () => { await view.result.current.saveRow(items[0], { name: "x" }); });
    expect(update).toHaveBeenCalledWith(items[0], { name: "x" });
    expect(reload).toHaveBeenCalled();
  });

  it("delById пустой строки удаляет без подтверждения", async () => {
    const { view, remove } = setup();
    await act(async () => { view.result.current.delById(1); });
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it("delById заполнённой строки показывает модалку подтверждения и не удаляет сразу", async () => {
    const { view, remove } = setup();
    expect(view.result.current.confirmModal).toBeNull();
    await act(async () => { view.result.current.delById(2); });
    expect(view.result.current.confirmModal).not.toBeNull();
    expect(remove).not.toHaveBeenCalled();
  });

  it("автоматически добавляет пустую строку, если включено и список пуст", async () => {
    const { add } = setup({ items: [], autoAddWhenEmpty: true });
    await waitFor(() => expect(add).toHaveBeenCalledTimes(1));
  });

  it("не автодобавляет, если выключено", async () => {
    const { add } = setup({ items: [], autoAddWhenEmpty: false });
    await new Promise(r => setTimeout(r, 20));
    expect(add).not.toHaveBeenCalled();
  });
});
