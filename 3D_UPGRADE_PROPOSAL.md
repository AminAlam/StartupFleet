# Proposal: Enhanced 3D World for Syntropic Fleet

This proposal outlines a plan to upgrade the 3D visualization from a schematic representation to an immersive, realistic environment.

## 1. Realistic Terrain & Environment
*   **Procedural Islands**: Replace simple cylinders with **low-poly terrain meshes**. Use Perlin noise to generate heightmaps for mountains and coastlines.
*   **Biomes**: Color-code islands based on their "health" or KPI status (e.g., Lush Green for on-track, Desert/Rocky for at-risk).
*   **Water Shader**: Implement a custom shader with:
    *   **Reflection/Refraction**: Real-time reflections of the sky and islands.
    *   **Foam Edges**: White foam where water intersects with land.
    *   **Depth Color**: Gradient from shallow turquoise to deep navy.
*   **Skybox & Atmosphere**: Add a dynamic skybox with a day/night cycle or a stylized "strategic dawn" aesthetic. Add volumetric fog to give depth to distant goals.

## 2. Enhanced Assets (GLTF Models)
*   **Ships**: Replace box primitives with actual **3D boat models** (e.g., low-poly sailboats or futuristic research vessels).
*   **Landmarks**: Use specific 3D icons for Main Goals (e.g., a Lighthouse for the North Star, a Fortress for "Defense", a Factory for "Production").
*   **Vegetation**: Scatter low-poly trees and rocks on islands to give them scale.

## 3. Advanced Animations
*   **Ship Movement**:
    *   **Wake Trails**: Particle systems trailing behind moving ships.
    *   **Bobbing Physics**: More realistic buoyancy matching the wave vertex shader.
    *   **Sails**: Animate sails reacting to a "wind" direction (perhaps pointing towards the North Star).
*   **Selection Effects**: When an island is hovered/selected, make it "lift" slightly out of the water or glow with a rim light.
*   **North Star Pulse**: A volumetric light shaft beaming down from the North Star.

## 4. UI & Interaction Improvements
*   **3D Labels**: Use `CSS2DRenderer` or `CSS3DRenderer` to overlay HTML labels on top of 3D objects. This allows for crisp text, buttons, and interactions (like "Expand" buttons) directly in the 3D world.
*   **Mini-Map**: A 2D overlay showing the camera's location in the world.
*   **Cinematic Camera**: "Focus" mode that smoothly pans and tilts the camera to frame a specific Expedition or Ship when clicked in the sidebar.

## 5. Technical Implementation Steps
1.  **Loader Integration**: Add `GLTFLoader` to `ThreeEngine` to handle external assets.
2.  **Shader Material**: Replace `MeshPhongMaterial` for water with `ShaderMaterial`.
3.  **Asset Pipeline**: Sourcing or creating low-poly assets (Blender/Kenney Assets).
4.  **Performance Optimization**: Use `InstancedMesh` for repeated objects like trees or fleet ships to maintain 60 FPS.

## Next Steps
*   Approve the "Low Poly" aesthetic direction.
*   Select a color palette (Stylized Realism vs. Abstract Neon).
*   Begin implementing the Water Shader and Terrain Generation.

