export class Camera2D {
    constructor(canvas) {
        this.canvas = canvas;
        this.x = 0; 
        this.y = 0; 
        this.zoom = 1;
        this.minZoom = 0.2;
        this.maxZoom = 4.0;
    }

    toWorld(screenX, screenY) {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        return {
            x: (screenX - centerX) / this.zoom + this.x,
            y: (screenY - centerY) / this.zoom + this.y
        };
    }

    apply(ctx) {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.scale(this.zoom, this.zoom);
        ctx.translate(-this.x, -this.y);
    }

    zoomIn() { this.zoom = Math.min(this.zoom * 1.2, this.maxZoom); }
    zoomOut() { this.zoom = Math.max(this.zoom / 1.2, this.minZoom); }
    reset() { this.x = 0; this.y = 0; this.zoom = 1; }
}
