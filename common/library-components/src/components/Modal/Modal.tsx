import React from "react";
import clsx from "clsx";
import { useContext, useEffect, useState } from "react";

import StatsModalTab from "./Stats";
import Sidebar from "./Sidebar";
import { GraphPage } from "./Graph/GraphPage";
import { CustomGraphData } from "./Graph/data";
import HeaderBar from "./HeaderBar";
import { ReplicacheContext, Topic } from "../../store";
import RecentModalTab from "./Recent";
import { LindyIcon } from "../Icons";
import HighlightsTab from "./Highlights";

export function LibraryModalPage({
    darkModeEnabled = false,
    currentArticle,
    initialTopic,
    graph,
    new_link_count,
    isVisible = true,
    closeModal = () => {},
}: {
    darkModeEnabled?: boolean;
    currentArticle?: string;
    initialTopic?: Topic;
    graph?: CustomGraphData;
    new_link_count?: number;
    isVisible?: boolean;
    closeModal?: () => void;
}) {
    const rep = useContext(ReplicacheContext);
    const [articleCount, setArticleCount] = useState<number>();
    useEffect(() => {
        rep?.query.getArticlesCount().then(setArticleCount);
    }, [rep]);

    const [currentTab, setCurrentTab] = useState("graph");

    const [currentTopic, setCurrentTopic] = useState<Topic | undefined>(
        initialTopic
    );
    useEffect(() => {
        setCurrentTopic(initialTopic);
    }, [initialTopic]);
    function showTopic(topic: Topic) {
        setCurrentTopic(topic);
        setCurrentTab("graph");
    }

    return (
        <div
            className={clsx(
                "modal invisible fixed top-0 left-0 h-screen w-screen text-base opacity-0",
                isVisible ? "modal-visible" : "modal-hidden",
                darkModeEnabled && "dark"
            )}
            style={
                darkModeEnabled
                    ? {
                          colorScheme: "dark",
                      }
                    : {}
            }
        >
            <div
                className="modal-background absolute top-0 left-0 h-full w-full cursor-zoom-out bg-stone-800 opacity-50 dark:bg-[rgb(19,21,22)]"
                onClick={closeModal}
            />
            <div className="modal-content relative z-10 mx-auto mt-10 flex h-5/6 max-h-[700px] max-w-5xl flex-col overflow-hidden rounded-lg bg-white text-stone-800 shadow dark:bg-[#212121] dark:text-[rgb(232,230,227)]">
                <ModalContent
                    articleCount={articleCount}
                    currentArticle={currentArticle}
                    currentTopic={currentTopic}
                    darkModeEnabled={darkModeEnabled}
                    graph={graph}
                    new_link_count={new_link_count}
                    currentTab={currentTab}
                    setCurrentTab={setCurrentTab}
                    showTopic={showTopic}
                />
            </div>
        </div>
    );
}

function ModalContent({
    currentArticle,
    currentTopic,
    articleCount,
    darkModeEnabled,
    graph,
    new_link_count,
    currentTab,
    setCurrentTab,
    showTopic,
}: {
    currentArticle?: string;
    currentTopic?: Topic;
    articleCount?: number;
    darkModeEnabled: boolean;
    graph?: CustomGraphData;
    new_link_count?: number;
    currentTab: string;
    setCurrentTab: (tab: string) => void;
    showTopic: (topic: Topic) => void;
}) {
    return (
        <div className="font-text flex h-full overflow-hidden text-base">
            <aside className="left-side p-4">
                <div className="flex h-full w-32 flex-col">
                    <div
                        className="mb-4 flex w-full cursor-pointer items-center gap-1.5 transition-all hover:scale-[97%]"
                        onClick={() => setCurrentTab("stats")}
                    >
                        <LindyIcon className="w-8" />
                        <span className="font-title text-2xl font-bold">
                            Library
                        </span>
                    </div>

                    <Sidebar
                        currentTab={currentTab}
                        currentTopic={currentTopic}
                        setCurrentTab={setCurrentTab}
                        new_link_count={new_link_count}
                        darkModeEnabled={darkModeEnabled}
                    />
                </div>
            </aside>
            <div
                className={clsx(
                    "right-side flex max-h-full w-full flex-col",
                    currentTab === "stats"
                        ? "overflow-y-scroll"
                        : "overflow-y-auto",
                    currentTab === "graph" ? "" : "p-4"
                )}
            >
                {/* <HeaderBar
                    articleCount={articleCount}
                    currentTab={currentTab}
                    setCurrentTab={setCurrentTab}
                /> */}

                {currentTab === "recent" && (
                    <RecentModalTab
                        currentTopic={currentTopic}
                        darkModeEnabled={darkModeEnabled}
                        showTopic={showTopic}
                    />
                )}
                {currentTab === "graph" && (
                    <GraphPage
                        graph={graph}
                        darkModeEnabled={darkModeEnabled}
                        currentArticle={currentArticle}
                        currentTopic={currentTopic}
                    />
                )}
                {currentTab === "stats" && (
                    <StatsModalTab
                        articleCount={articleCount}
                        darkModeEnabled={darkModeEnabled}
                        showTopic={showTopic}
                    />
                )}
                {currentTab === "highlights" && <HighlightsTab />}
            </div>
        </div>
    );
}
