// Hook que encapsula toda la lógica de zoom y pan de los gráficos de telemetría.
// Gestiona el dominio visible, el wheel handler con passive:false y el pan con ratón.

import { useState, useEffect, useCallback, useRef } from 'react';

const ZOOM_FACTOR = 0.15;
const CHART_MARGIN_LEFT = 27;
const CHART_MARGIN_RIGHT = 8;

export function useChartZoom(maxDistance) {
    const [domainStart, setDomainStart] = useState(0);
    const [domainEnd, setDomainEnd] = useState(0);
    const domainRef = useRef({ start: 0, end: 0, max: 0 });
    const panRef = useRef({ active: false, startX: 0, startStart: 0, startEnd: 0 });

    useEffect(() => {
        if (maxDistance > 0) {
            setDomainStart(0);
            setDomainEnd(maxDistance);
            domainRef.current = { start: 0, end: maxDistance, max: maxDistance };
        }
    }, [maxDistance]);

    useEffect(() => {
        domainRef.current.start = domainStart;
        domainRef.current.end = domainEnd;
    }, [domainStart, domainEnd]);

    const applyDomain = useCallback((s, e) => {
        const { max } = domainRef.current;
        const range = e - s;
        if (s < 0) { s = 0; e = range; }
        if (e > max) { e = max; s = max - range; }
        s = Math.max(0, s);
        e = Math.min(max, e);
        setDomainStart(s);
        setDomainEnd(e);
        domainRef.current.start = s;
        domainRef.current.end = e;
    }, []);

    const pixelToDistance = useCallback((clientX, rect) => {
        const plotArea = rect.left + CHART_MARGIN_LEFT;
        const plotWidth = rect.width - CHART_MARGIN_LEFT - CHART_MARGIN_RIGHT;
        const ratio = Math.max(0, Math.min(1, (clientX - plotArea) / plotWidth));
        const { start, end } = domainRef.current;
        return start + ratio * (end - start);
    }, []);

    // Devuelve un handler de rueda listo para registrar con { passive: false }
    const buildWheelHandler = useCallback((getRect) => (e) => {
        e.preventDefault();
        const rect = getRect();
        const w = rect.width - CHART_MARGIN_LEFT - CHART_MARGIN_RIGHT;
        const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left - CHART_MARGIN_LEFT) / w));
        const { start, end, max } = domainRef.current;
        const range = end - start;
        const delta = e.deltaY > 0 ? 1 : -1;
        const newRange = Math.max(100, Math.min(max, range * (1 + delta * ZOOM_FACTOR)));
        const anchor = start + ratio * range;
        applyDomain(anchor - ratio * newRange, anchor + (1 - ratio) * newRange);
    }, [applyDomain]);

    const handleMouseDown = useCallback((e) => {
        if (e.button !== 0) return;
        panRef.current = {
            active: true,
            startX: e.clientX,
            startStart: domainRef.current.start,
            startEnd: domainRef.current.end,
        };
    }, []);

    const handleMouseMove = useCallback((e) => {
        if (!panRef.current.active) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const w = rect.width - CHART_MARGIN_LEFT - CHART_MARGIN_RIGHT;
        const range = panRef.current.startEnd - panRef.current.startStart;
        const delta = -(e.clientX - panRef.current.startX) / w * range;
        applyDomain(
            panRef.current.startStart + delta,
            panRef.current.startEnd + delta,
        );
    }, [applyDomain]);

    const handleMouseUp = useCallback(() => { panRef.current.active = false; }, []);

    const resetZoom = useCallback(() => {
        applyDomain(0, domainRef.current.max);
    }, [applyDomain]);

    const zoomPercent = maxDistance && (domainEnd - domainStart) > 0
        ? Math.round(maxDistance / (domainEnd - domainStart) * 100)
        : 100;

    return {
        domain: [domainStart, domainEnd],
        buildWheelHandler,
        handleMouseDown,
        handleMouseMove,
        handleMouseUp,
        resetZoom,
        zoomPercent,
        pixelToDistance,
    };
}