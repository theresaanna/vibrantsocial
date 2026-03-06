"use client";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useLexicalNodeSelection } from "@lexical/react/useLexicalNodeSelection";
import { $getNodeByKey, type NodeKey } from "lexical";
import { useCallback, useMemo, useState } from "react";
import { $isExcalidrawNode } from "./ExcalidrawNode";

interface ExcalidrawComponentProps {
  data: string;
  nodeKey: NodeKey;
}

export default function ExcalidrawComponent({ data, nodeKey }: ExcalidrawComponentProps) {
  const [editor] = useLexicalComposerContext();
  const [isSelected, setSelected] = useLexicalNodeSelection(nodeKey);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const sceneData = useMemo(() => {
    try {
      return JSON.parse(data);
    } catch {
      return {};
    }
  }, [data]);

  const hasContent = sceneData?.elements?.length > 0;

  const handleSave = useCallback(
    (newData: string) => {
      editor.update(() => {
        const node = $getNodeByKey(nodeKey);
        if ($isExcalidrawNode(node)) {
          node.setData(newData);
        }
      });
      setIsModalOpen(false);
    },
    [editor, nodeKey]
  );

  return (
    <>
      <div
        className={`my-2 cursor-pointer rounded-lg border p-4 transition-colors ${
          isSelected
            ? "border-blue-500 ring-2 ring-blue-500"
            : "border-zinc-200 hover:border-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-500"
        }`}
        onClick={() => setSelected(true)}
        onDoubleClick={() => {
          if (editor.isEditable()) setIsModalOpen(true);
        }}
        role="button"
        tabIndex={0}
      >
        {hasContent ? (
          <div className="flex min-h-[200px] items-center justify-center text-zinc-500">
            <div className="text-center">
              <svg className="mx-auto mb-2 h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              <p className="text-sm">Excalidraw Drawing</p>
              <p className="text-xs text-zinc-400">{sceneData.elements?.length} element(s) — Double-click to edit</p>
            </div>
          </div>
        ) : (
          <div className="flex min-h-[100px] items-center justify-center text-zinc-400">
            <div className="text-center">
              <p className="text-sm">Empty Drawing</p>
              <p className="text-xs">Double-click to start drawing</p>
            </div>
          </div>
        )}
      </div>
      {isModalOpen && (
        <ExcalidrawModal
          initialData={data}
          onSave={handleSave}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </>
  );
}

function ExcalidrawModal({
  initialData,
  onSave,
  onClose,
}: {
  initialData: string;
  onSave: (data: string) => void;
  onClose: () => void;
}) {
  const [Excalidraw, setExcalidraw] = useState<React.ComponentType<Record<string, unknown>> | null>(null);
  const [sceneRef, setSceneRef] = useState<{ getSceneElements: () => unknown; getAppState: () => unknown } | null>(null);

  // Dynamically import Excalidraw
  useState(() => {
    import("@excalidraw/excalidraw").then((mod) => {
      setExcalidraw(() => mod.Excalidraw);
    });
  });

  const initialScene = useMemo(() => {
    try {
      return JSON.parse(initialData);
    } catch {
      return {};
    }
  }, [initialData]);

  function handleSave() {
    if (sceneRef) {
      const data = JSON.stringify({
        elements: sceneRef.getSceneElements(),
        appState: sceneRef.getAppState(),
      });
      onSave(data);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-white dark:bg-zinc-900">
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-2 dark:border-zinc-700">
        <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">Excalidraw</h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSave}
            className="rounded-lg bg-blue-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-600"
          >
            Save
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-zinc-200 px-4 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600"
          >
            Cancel
          </button>
        </div>
      </div>
      <div className="flex-1">
        {Excalidraw ? (
          <Excalidraw
            initialData={initialScene}
            excalidrawAPI={(api: unknown) => setSceneRef(api as typeof sceneRef)}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-zinc-500">
            Loading Excalidraw...
          </div>
        )}
      </div>
    </div>
  );
}
