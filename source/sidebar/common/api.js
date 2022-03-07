import axios from "axios";
import { hypothesisToLindyFormat } from "../../common/getAnnotations";
import {
    getHypothesisToken,
    getHypothesisUsername,
} from "../../common/storage";

// const lindyApiUrl = 'http://127.0.0.1:8000';
const lindyApiUrl = "https://api2.lindylearn.io";
const hypothesisApi = "https://api.hypothes.is/api";

// --- global fetching

export async function getAnnotations(url) {
    const [publicAnnotations, userAnnotations] = await Promise.all([
        getLindyAnnotations(url),
        getHypothesisAnnotations(url),
    ]);

    // take from lindy preferrably, otherwise hypothesis
    // -> show replies, upvotes metadata when available, but new annotations immediately
    // edits might take a while to propagate this way
    const seenIds = new Set(publicAnnotations.map((a) => a.id));
    let annotations = publicAnnotations;
    for (const annotation of userAnnotations) {
        if (!seenIds.has(annotation.id)) {
            annotations.push(annotation);
        }
    }

    const username = await getHypothesisUsername();
    annotations = annotations.map((a) => ({
        ...a,
        isMyAnnotation: a.author === username,
    }));

    return annotations;
}

// public annotations via lindy api
async function getLindyAnnotations(url) {
    const response = await axios.get(`${lindyApiUrl}/annotations`, {
        ...(await _getConfig()),
        params: {
            page_url: url,
        },
    });

    return response.data.results.map((a) => ({ ...a, isPublic: true }));
}

// private annotations directly from hypothesis
async function getHypothesisAnnotations(url) {
    const username = await getHypothesisUsername();
    const response = await axios.get(`${hypothesisApi}/search`, {
        ...(await _getConfig()),
        params: {
            url,
            user: `acct:${username}@hypothes.is`,
        },
    });

    return response.data.rows
        .filter((a) => !a.references || a.references.length === 0)
        .map(hypothesisToLindyFormat);
}

export async function getPageHistory(url) {
    const response = await axios.get(
        `${lindyApiUrl}/annotations/get_page_history`,
        {
            params: { page_url: url },
        },
        await _getConfig()
    );
    return response.data;
}

// --- user actions

export async function createAnnotation(pageUrl, localAnnotation) {
    const username = await getHypothesisUsername();
    const response = await axios.post(
        `${hypothesisApi}/annotations`,
        {
            uri: pageUrl,
            text: localAnnotation.text,
            target: [
                {
                    source: pageUrl,
                    selector: localAnnotation.quote_html_selector,
                },
            ],
            tags: localAnnotation.tags,
            permissions: {
                read: [
                    localAnnotation.isPublic
                        ? "group:__world__"
                        : `acct:${username}@hypothes.is`,
                ],
            },
        },
        await _getConfig()
    );
    return response.data;
}

export async function deleteAnnotation(annotationId) {
    await axios.delete(
        `${hypothesisApi}/annotations/${annotationId}`,
        await _getConfig()
    );
}

export async function patchAnnotation(annotation) {
    const username = await getHypothesisUsername();
    const response = await axios.patch(
        `${hypothesisApi}/annotations/${annotation.id}`,
        {
            text: annotation.text,
            tags: annotation.tags,
            permissions: {
                read: [
                    annotation.isPublic
                        ? "group:__world__"
                        : `acct:${username}@hypothes.is`,
                ],
            },
        },
        await _getConfig()
    );
    return response.data;
}

export async function upvoteAnnotation(pageUrl, annotationId, isUpvote) {
    await axios.post(
        `${lindyApiUrl}/annotations/upvote`,
        {
            annotation_id: annotationId,
            is_unvote: !isUpvote,
        },
        await _getConfig()
    );
}

// --- social information annotations

export async function getUserDetails(username) {
    // end with .json because might contain dots
    const response = await axios.get(
        `${lindyApiUrl}/annotators/${username}.json`,
        await _getConfig()
    );
    return response.data;
}

export async function getDomainDetails(url) {
    // end with .json because might contain dots
    const response = await axios.get(
        `${lindyApiUrl}/domains/${url}.json`,
        await _getConfig()
    );
    return response.data;
}

export async function getTagDetails(tag) {
    // end with .json because might contain dots
    const response = await axios.get(
        `${lindyApiUrl}/tags/${tag}.json`,
        await _getConfig()
    );
    return response.data;
}

async function _getConfig() {
    const apiToken = await getHypothesisToken();

    if (apiToken) {
        return {
            headers: { Authorization: `Bearer ${apiToken}` },
        };
    }
    return {};
}