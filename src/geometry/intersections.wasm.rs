use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct Point {
    x: f64,
    y: f64,
}

#[wasm_bindgen]
impl Point {
    pub fn new(x: f64, y: f64) -> Point {
        Point { x, y }
    }
}

#[wasm_bindgen]
pub fn find_intersection(
    p1: &Point, 
    p2: &Point, 
    p3: &Point, 
    p4: &Point
) -> Option<Point> {
    // Line segment intersection calculation
    let x1 = p1.x;
    let y1 = p1.y;
    let x2 = p2.x;
    let y2 = p2.y;
    let x3 = p3.x;
    let y3 = p3.y;
    let x4 = p4.x;
    let y4 = p4.y;

    let denominator = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
    
    // Check for parallel lines
    if denominator.abs() < 1e-10 {
        return None;
    }

    let ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denominator;
    let ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denominator;

    // Check if intersection is within line segments
    if ua < 0.0 || ua > 1.0 || ub < 0.0 || ub > 1.0 {
        return None;
    }

    // Calculate intersection point
    let x = x1 + ua * (x2 - x1);
    let y = y1 + ua * (y2 - y1);

    Some(Point::new(x, y))
}

#[wasm_bindgen]
pub fn find_all_intersections(
    vertices1: &[f64], 
    vertices2: &[f64]
) -> Vec<f64> {
    let mut intersections = Vec::new();

    // Iterate through line segments of both polygons
    for i in (0..vertices1.len()).step_by(2) {
        for j in (0..vertices2.len()).step_by(2) {
            let p1 = Point::new(vertices1[i], vertices1[i+1]);
            let p2 = Point::new(vertices1[(i+2) % vertices1.len()], 
                                vertices1[(i+3) % vertices1.len()]);
            let p3 = Point::new(vertices2[j], vertices2[j+1]);
            let p4 = Point::new(vertices2[(j+2) % vertices2.len()], 
                                vertices2[(j+3) % vertices2.len()]);

            if let Some(intersection) = find_intersection(&p1, &p2, &p3, &p4) {
                intersections.push(intersection.x);
                intersections.push(intersection.y);
            }
        }
    }

    intersections
}
