import React, { useState, useRef, useEffect, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { AppView, ChatMessage, SelectionBox, SavedSession, AnswerCardData, SemanticVideoData, SceneData, SceneAction, ContextTier, ContextualBundle } from '../types';
import { ArrowLeft, MessageSquare, Mic, MicOff, Send, X, BoxSelect, Play, Pause, Gauge, Volume2, VolumeX, Eraser, Loader2, AlertCircle, CheckCircle2, Activity, ChevronDown, ChevronRight, HelpCircle, Clock, LayoutTemplate, Zap, Subtitles, ChevronUp, Radio, StopCircle, ClipboardEdit, Hand, HandIcon } from 'lucide-react';
import { orchestrateQnA, LiveSession, isApiKeyAvailable } from '../services/geminiService';

// --- MOCK DATA FROM DOCUMENT (FALLBACK) ---
const MOCK_SCENE_DATA: SemanticVideoData = {
  "meta": {
    "project_id": "gradient_descent_101",
    "language": "en",
    "version": "narration_v2"
  },
  "scenes": [
    {
      "scene_id": "S01",
      "start_time": 0.0,
      "end_time": 36.0,
      "visual_context": {
        "layout": {
          "strategy_name": "Data and Metric Split",
          "description": "A split layout emphasizing the contrast between the visual fit (the line) and the mathematical score (the cost). The left side is the 'Data Space', the right side is the 'Scoreboard'.",
          "regions": [
            {
              "name": "data_space",
              "bounds": "[0, 0, 0.65, 1]",
              "purpose": "Displays the coordinate system with data points and the regression line."
            },
            {
              "name": "metric_space",
              "bounds": "[0.65, 0, 0.35, 1]",
              "purpose": "Displays the Cost Function definition and the current error value."
            }
          ]
        },
        "frame_description": "We start in 'Data Space'. The viewer sees a scatter plot of data points with a regression line passing through them poorly. Vertical lines (residuals) connect each point to the regression line, physically representing the error. On the right, the 'Scoreboard' defines the Cost Function (J) as the sum of these squared errors, displaying a large red number indicating a bad fit. The goal is to minimize this number.",
        "components": [
          {
            "name": "scatter_points",
            "type": "ScatterPoints",
            "region": "data_space",
            "content_specs": "Randomly distributed data points roughly following a positive linear trend ($y \\approx 2x + 1$). Points are distinct and clearly visible."
          },
          {
            "name": "bad_fit_line",
            "type": "LinePlot",
            "region": "data_space",
            "content_specs": "A straight line $y = wx$ that clearly does not fit the data well (e.g., slope is too steep or too flat). Color: Primary highlight."
          },
          {
            "name": "residual_lines",
            "type": "Shape",
            "region": "data_space",
            "content_specs": "Vertical dashed lines connecting each scatter point to the 'bad_fit_line'. These represent the error terms $(y_i - ^{y}_i)$."
          },
          {
            "name": "cost_definition",
            "type": "MathTex",
            "region": "metric_space",
            "content_specs": "$J(w) = \\frac{1}{n} \\sum (y_{pred} - y_{actual})^2$. Presented as the 'Score' formula."
          },
          {
            "name": "current_cost_value",
            "type": "Text",
            "region": "metric_space",
            "content_specs": "Large, bold text: 'Cost $J = HIGH$'. Color: Red, to indicate a 'bad' state."
          }
        ]
      },
      "lines": [
        {
          "line_id": "S01_L001",
          "text": "Imagine we have a jumbled set of data points in front of us.",
          "start_s": 0.0,
          "end_s": 3.0
        },
        {
          "line_id": "S01_L002",
          "text": "Our task is to draw a straight line that passes through them as perfectly as possible; this is **Linear Regression**.",
          "start_s": 3.0,
          "end_s": 11.0
        },
        {
          "line_id": "S01_L003",
          "text": "If we just draw lines randomly, it's too inefficient.",
          "start_s": 11.0,
          "end_s": 15.0
        },
        {
          "line_id": "S01_L004",
          "text": "We need a scoreboard to tell us just how bad each line is.",
          "start_s": 15.0,
          "end_s": 19.0
        },
        {
          "line_id": "S01_L005",
          "text": "By calculating the vertical distance error from all data points to the line, we get a score.",
          "start_s": 19.0,
          "end_s": 25.0
        },
        {
          "line_id": "S01_L006",
          "text": "This metric, which measures the total error, is the **Cost Function**.",
          "start_s": 26.0,
          "end_s": 30.0
        },
        {
          "line_id": "S01_L007",
          "text": "Now, our goal is no longer to draw lines, but to minimize this error score.",
          "start_s": 32.0,
          "end_s": 36.0
        }
      ],
      "actions": [
        {
          "action_id": "S01_A001",
          "type": "enter",
          "targets": [
            "scatter_points"
          ],
          "description": "Fade in the scatter plot data points to establish the problem space.",
          "track": "geom:scatter",
          "layer": 0,
          "start_s": 0.0,
          "duration_s": 2.0
        },
        {
          "action_id": "S01_A002",
          "type": "enter",
          "targets": [
            "bad_fit_line"
          ],
          "description": "Draw a straight line through the data to represent the initial model.",
          "track": "geom:line",
          "layer": 1,
          "start_s": 3.0,
          "duration_s": 1.0
        },
        {
          "action_id": "S01_A003",
          "type": "transform",
          "targets": [
            "bad_fit_line"
          ],
          "description": "Wiggle or shift the line randomly to illustrate the inefficiency of guessing.",
          "track": "geom:line",
          "layer": 1,
          "start_s": 11.0,
          "duration_s": 4.0
        },
        {
          "action_id": "S01_A004",
          "type": "enter",
          "targets": [
            "cost_definition",
            "current_cost_value"
          ],
          "description": "Reveal the scoreboard area with the cost function formula and current high error value.",
          "track": "ui:metric",
          "layer": 2,
          "start_s": 15.0,
          "duration_s": 2.0
        },
        {
          "action_id": "S01_A005",
          "type": "draw",
          "targets": [
            "residual_lines"
          ],
          "description": "Draw vertical dashed lines from points to the regression line to visualize error.",
          "track": "geom:residuals",
          "layer": 0,
          "start_s": 19.0,
          "duration_s": 6.0
        },
        {
          "action_id": "S01_A006",
          "type": "emphasis",
          "targets": [
            "cost_definition"
          ],
          "description": "Highlight the cost function formula to associate it with the 'Total Error' concept.",
          "track": "style:formula",
          "layer": 2,
          "start_s": 28.0,
          "duration_s": 1.0
        },
        {
          "action_id": "S01_A007",
          "type": "value_update",
          "targets": [
            "current_cost_value"
          ],
          "description": "Pulse the cost value text to emphasize the goal of minimization.",
          "track": "text:score",
          "layer": 2,
          "start_s": 34.0,
          "duration_s": 1.0
        }
      ]
    },
    {
      "scene_id": "S02",
      "start_time": 36.0,
      "end_time": 65.0,
      "visual_context": {
        "layout": {
          "strategy_name": "Dual Space Correspondence",
          "description": "A balanced 50/50 split screen to map 'Line Rotation' directly to 'Curve Traversal'.",
          "regions": [
            {
              "name": "left_data_view",
              "bounds": "[0, 0, 0.5, 1]",
              "purpose": "Shows the regression line rotating."
            },
            {
              "name": "right_parameter_view",
              "bounds": "[0.5, 0, 0.5, 1]",
              "purpose": "Shows the Cost Function curve (The Bowl) being traced."
            }
          ]
        },
        "frame_description": "The viewer moves their eyes from left to right to understand the mapping. On the left, the line exists in $(x,y)$ space; on the right, we introduce 'Parameter Space' where the axes are Weight ($w$) vs Cost ($J$). A convex parabola (U-shape) is plotted on the right. A specific point on this parabola is highlighted, corresponding exactly to the current slope of the line on the left. This visualizes that 'changing the line' equals 'moving along the curve'.",
        "components": [
          {
            "name": "rotating_line_ghosts",
            "type": "LinePlot",
            "region": "left_data_view",
            "content_specs": "The current regression line (solid) plus 2-3 semi-transparent 'ghost' lines indicating previous positions/rotations."
          },
          {
            "name": "parameter_axes",
            "type": "Axes2D",
            "region": "right_parameter_view",
            "content_specs": "X-axis: Weight ($w$). Y-axis: Cost ($J$). Labeling must be clear to distinguish from the x,y axes on the left."
          },
          {
            "name": "cost_curve_parabola",
            "type": "LinePlot",
            "region": "right_parameter_view",
            "content_specs": "A smooth U-shaped parabola representing the error landscape. The minimum is at the center bottom."
          },
          {
            "name": "current_state_dot",
            "type": "ScatterPoints",
            "region": "right_parameter_view",
            "content_specs": "A single distinct dot placed high on the parabola arm, corresponding to the current 'bad' line on the left."
          },
          {
            "name": "mapping_arrow",
            "type": "Arrow",
            "region": "right_parameter_view",
            "content_specs": "A conceptual connector or annotation linking the slope $w$ on the left to the x-position on the right."
          }
        ]
      },
      "lines": [
        {
          "line_id": "S02_L001",
          "text": "To find the minimum score, we need to change our perspective.",
          "start_s": 36.0,
          "end_s": 40.0
        },
        {
          "line_id": "S02_L002",
          "text": "Stop staring at that wobbly line on the left.",
          "start_s": 40.0,
          "end_s": 43.0
        },
        {
          "line_id": "S02_L003",
          "text": "Look to the right; this shows the slope of the line, which is... **Weights**, the relationship with error.",
          "start_s": 44.0,
          "end_s": 50.0
        },
        {
          "line_id": "S02_L004",
          "text": "When we rotate the left straight line, the point on the right will draw a curve like a bowl.",
          "start_s": 51.0,
          "end_s": 56.0
        },
        {
          "line_id": "S02_L005",
          "text": "The lowest point of this bowl corresponds to that perfect straight line.",
          "start_s": 56.0,
          "end_s": 61.0
        },
        {
          "line_id": "S02_L006",
          "text": "So, the problem changes from 'drawing a line' to 'finding the bottom of the bowl.",
          "start_s": 61.0,
          "end_s": 65.0
        }
      ],
      "actions": [
        {
          "action_id": "S02_A001",
          "type": "enter",
          "targets": [
            "rotating_line_ghosts",
            "parameter_axes"
          ],
          "description": "Set up the dual view: Line space on the left, empty parameter axes on the right.",
          "track": "geom:setup",
          "layer": 0,
          "start_s": 36.0,
          "duration_s": 2.0
        },
        {
          "action_id": "S02_A002",
          "type": "emphasis",
          "targets": [
            "rotating_line_ghosts"
          ],
          "description": "Highlight the left side line to address the 'wobbly line' mentioned.",
          "track": "style:left",
          "layer": 1,
          "start_s": 40.0,
          "duration_s": 1.0
        },
        {
          "action_id": "S02_A003",
          "type": "enter",
          "targets": [
            "current_state_dot"
          ],
          "description": "Pop in the single dot on the right side graph to represent the current slope weight.",
          "track": "geom:dot",
          "layer": 2,
          "start_s": 44.0,
          "duration_s": 1.0
        },
        {
          "action_id": "S02_A004",
          "type": "transform",
          "targets": [
            "rotating_line_ghosts"
          ],
          "description": "Rotate the line on the left through various slopes.",
          "track": "geom:rotation",
          "layer": 1,
          "start_s": 51.0,
          "duration_s": 5.0
        },
        {
          "action_id": "S02_A005",
          "type": "draw",
          "targets": [
            "cost_curve_parabola"
          ],
          "description": "Trace the U-shaped parabola on the right simultaneously as the line rotates.",
          "track": "geom:curve",
          "layer": 0,
          "start_s": 51.0,
          "duration_s": 5.0
        },
        {
          "action_id": "S02_A006",
          "type": "emphasis",
          "targets": [
            "cost_curve_parabola"
          ],
          "description": "Highlight the bottom-most point of the bowl to indicate the optimal solution.",
          "track": "style:curve",
          "layer": 0,
          "start_s": 56.0,
          "duration_s": 1.0
        },
        {
          "action_id": "S02_A007",
          "type": "move",
          "targets": [
            "current_state_dot"
          ],
          "description": "Slide the state dot along the curve towards the bottom to visualize the new goal.",
          "track": "geom:dot",
          "layer": 2,
          "start_s": 63.0,
          "duration_s": 2.0
        }
      ]
    },
    {
      "scene_id": "S03",
      "start_time": 65.0,
      "end_time": 96.0,
      "visual_context": {
        "layout": {
          "strategy_name": "Landscape Zoom",
          "description": "Full-screen focus on the Parameter Space (The Bowl) to explain the gradient descent mechanics.",
          "regions": [
            {
              "name": "landscape_main",
              "bounds": "[0, 0.2, 1, 0.8]",
              "purpose": "The terrain for the 'Hiker' metaphor."
            },
            {
              "name": "mechanics_legend",
              "bounds": "[0, 0, 1, 0.2]",
              "purpose": "Explanatory labels for the visual elements (Slope, Step)."
            }
          ]
        },
        "frame_description": "We zoom in on the U-curve (The Bowl). The 'Hiker' (a ball or dot) is positioned on a steep slope. A tangent line touches the Hiker, representing the Gradient (Slope). An arrow points in the opposite direction of the slope, indicating the 'Descent' step. The visual emphasizes that the steepness determines the urgency of the move, and the step size is controlled by the Learning Rate.",
        "components": [
          {
            "name": "zoomed_parabola",
            "type": "LinePlot",
            "region": "landscape_main",
            "content_specs": "The same Cost Function U-curve, but zoomed in to focus on one side of the valley."
          },
          {
            "name": "hiker_marker",
            "type": "Shape",
            "region": "landscape_main",
            "content_specs": "A circle or icon representing the current parameter value $w_{old}$. Placed on the steep part of the curve."
          },
          {
            "name": "tangent_slope",
            "type": "LinePlot",
            "region": "landscape_main",
            "content_specs": "A straight line tangent to the curve at the 'hiker_marker'. Visualizes $\\frac{\\partial J}{\\partial w}$."
          },
          {
            "name": "descent_vector",
            "type": "Arrow",
            "region": "landscape_main",
            "content_specs": "An arrow starting at the hiker and pointing roughly towards the bottom of the valley (horizontal component). Label: 'Step'."
          },
          {
            "name": "blindness_metaphor",
            "type": "CalloutBox",
            "region": "mechanics_legend",
            "content_specs": "Text: 'The computer is blind. It only feels the slope under its feet.' Positioned to explain why we need the derivative."
          }
        ]
      },
      "lines": [
        {
          "line_id": "S03_L001",
          "text": "However, the computer is a 'blindfolded hiker'; it cannot see the entire shape of the bowl.",
          "start_s": 65.0,
          "end_s": 71.0
        },
        {
          "line_id": "S03_L002",
          "text": "It stands halfway up the mountain and can only feel the slope beneath its feet.",
          "start_s": 71.0,
          "end_s": 76.0
        },
        {
          "line_id": "S03_L003",
          "text": "The direction and steepness of this slope are mathematically termed **Gradient**.",
          "start_s": 76.0,
          "end_s": 80.0
        },
        {
          "line_id": "S03_L004",
          "text": "If the slope beneath our feet is uphill, we take a step in the opposite direction.",
          "start_s": 80.0,
          "end_s": 85.0
        },
        {
          "line_id": "S03_L005",
          "text": "How big this step is is determined by the **Learning Rate**.",
          "start_s": 86.0,
          "end_s": 88.0
        },
        {
          "line_id": "S03_L006",
          "text": "Taking too big a step might lead directly to the valley floor; taking too small a step will make the descent as slow as a snail.",
          "start_s": 89.0,
          "end_s": 96.0
        }
      ],
      "actions": [
        {
          "action_id": "S03_A001",
          "type": "enter",
          "targets": [
            "zoomed_parabola",
            "hiker_marker",
            "blindness_metaphor"
          ],
          "description": "Zoom into the curve showing the hiker marker and the 'blindness' label.",
          "track": "geom:scene_setup",
          "layer": 0,
          "start_s": 65.0,
          "duration_s": 2.0
        },
        {
          "action_id": "S03_A002",
          "type": "enter",
          "targets": [
            "tangent_slope"
          ],
          "description": "Draw the tangent line under the hiker to represent the local slope.",
          "track": "geom:tangent",
          "layer": 1,
          "start_s": 73.5,
          "duration_s": 1.0
        },
        {
          "action_id": "S03_A003",
          "type": "emphasis",
          "targets": [
            "tangent_slope"
          ],
          "description": "Flash or thicken the tangent line to emphasize the concept of 'Gradient'.",
          "track": "style:tangent",
          "layer": 1,
          "start_s": 80.0,
          "duration_s": 1.0
        },
        {
          "action_id": "S03_A004",
          "type": "enter",
          "targets": [
            "descent_vector"
          ],
          "description": "Show an arrow pointing opposite to the uphill slope.",
          "track": "geom:vector",
          "layer": 2,
          "start_s": 82.5,
          "duration_s": 1.0
        },
        {
          "action_id": "S03_A005",
          "type": "transform",
          "targets": [
            "descent_vector"
          ],
          "description": "Scale the arrow size up and down to represent the 'Learning Rate' influence.",
          "track": "geom:vector_scale",
          "layer": 2,
          "start_s": 87.0,
          "duration_s": 1.0
        },
        {
          "action_id": "S03_A006",
          "type": "move",
          "targets": [
            "hiker_marker"
          ],
          "description": "Make the hiker jump too far across the valley to visualize 'too big a step'.",
          "track": "geom:hiker",
          "layer": 1,
          "start_s": 89.0,
          "duration_s": 3.5
        }
      ]
    },
    {
      "scene_id": "S04",
      "start_time": 96.0,
      "end_time": 121.0,
      "visual_context": {
        "layout": {
          "strategy_name": "Equation Translation",
          "description": "Top-bottom layout. Top shows the mathematical update rule. Bottom provides the visual legend decoding the math.",
          "regions": [
            {
              "name": "formula_area",
              "bounds": "[0, 0.5, 1, 0.5]",
              "purpose": "Central stage for the Gradient Descent equation."
            },
            {
              "name": "component_map",
              "bounds": "[0, 0, 1, 0.5]",
              "purpose": "Breakdown of the equation terms into visual concepts."
            }
          ]
        },
        "frame_description": "The formal equation is presented centrally. We break it down to show it is just a translation of the previous scene. Each term in the equation is color-coded to match a specific visual concept: 'New Position' is the result, 'Old Position' is where we started, 'Alpha' is the Step Size, and the 'Gradient' is the Slope. This demystifies the formula.",
        "components": [
          {
            "name": "update_rule_equation",
            "type": "MathTex",
            "region": "formula_area",
            "content_specs": "$w_{new} = w_{old} - \\alpha \\frac{\\partial J}{\\partial w}$. Large, centered. Terms are colored differently (e.g., $\\alpha$ in Green, Gradient in Orange)."
          },
          {
            "name": "term_alpha_explainer",
            "type": "Text",
            "region": "component_map",
            "content_specs": "Matches $\\alpha$ color. Text: 'Learning Rate = Stride Length / Speed'."
          },
          {
            "name": "term_gradient_explainer",
            "type": "Text",
            "region": "component_map",
            "content_specs": "Matches Gradient color. Text: 'Derivative = Slope of the Hill (Direction)'."
          },
          {
            "name": "term_subtraction_explainer",
            "type": "Text",
            "region": "component_map",
            "content_specs": "Text: 'Minus sign = Walk AGAINST the slope (Downhill)'."
          },
          {
            "name": "final_convergence_hint",
            "type": "Shape",
            "region": "formula_area",
            "content_specs": "A small visual checkmark or icon appearing near the equation implying 'Solution Found' when slope becomes zero."
          }
        ]
      },
      "lines": [
        {
          "line_id": "S04_L001",
          "text": "Let's translate this downhill motion into that famous formula.",
          "start_s": 96.0,
          "end_s": 100.0
        },
        {
          "line_id": "S04_L002",
          "text": "The new position equals the old position, minus the step size multiplied by the slope.",
          "start_s": 100.0,
          "end_s": 105.0
        },
        {
          "line_id": "S04_L003",
          "text": "That is, the current parameter, minus **Learning Rate** multiplied by **Gradient**.",
          "start_s": 105.0,
          "end_s": 110.0
        },
        {
          "line_id": "S04_L004",
          "text": "As we approach the bottom of the bowl, the slope becomes flatter, and our step size will automatically decrease.",
          "start_s": 111.0,
          "end_s": 116.0
        },
        {
          "line_id": "S04_L005",
          "text": "When we finally stop, congratulations, we have found that perfect straight line.",
          "start_s": 116.0,
          "end_s": 121.0
        }
      ],
      "actions": [
        {
          "action_id": "S04_A001",
          "type": "enter",
          "targets": [
            "update_rule_equation"
          ],
          "description": "Reveal the full gradient descent formula in the center.",
          "track": "ui:formula",
          "layer": 0,
          "start_s": 100.0,
          "duration_s": 2.0
        },
        {
          "action_id": "S04_A002",
          "type": "emphasis",
          "targets": [
            "update_rule_equation"
          ],
          "description": "Highlight the 'New = Old - Step * Slope' structure as it is spoken.",
          "track": "style:formula",
          "layer": 0,
          "start_s": 100.0,
          "duration_s": 1.0
        },
        {
          "action_id": "S04_A003",
          "type": "enter",
          "targets": [
            "term_alpha_explainer",
            "term_gradient_explainer",
            "term_subtraction_explainer"
          ],
          "description": "Pop up the legend items explaining Alpha and Gradient below the formula.",
          "track": "ui:legend",
          "layer": 1,
          "start_s": 105.0,
          "duration_s": 2.0
        },
        {
          "action_id": "S04_A004",
          "type": "transform",
          "targets": [
            "term_alpha_explainer"
          ],
          "description": "Visually shrink the 'Step Size' text or icon to show it decreasing as slope flattens.",
          "track": "geom:legend_size",
          "layer": 1,
          "start_s": 113.5,
          "duration_s": 1.0
        },
        {
          "action_id": "S04_A005",
          "type": "enter",
          "targets": [
            "final_convergence_hint"
          ],
          "description": "Show a checkmark or success indicator next to the formula implying convergence.",
          "track": "ui:hint",
          "layer": 2,
          "start_s": 118.5,
          "duration_s": 1.0
        }
      ]
    }
  ]
};

interface PlayerViewProps {
  onNavigate: (view: AppView) => void;
  session: SavedSession | null;
  onUpdateSession: (id: string, history: ChatMessage[]) => void;
}

interface Point { x: number; y: number; }

const DEFAULT_VIDEO = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";
const PLAYBACK_RATES = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

const formatTime = (seconds: number) => {
  if (!seconds || isNaN(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

// --- COMPONENT: Sidebar Voice Panel (Compact Version) ---
interface SidebarVoicePanelProps {
    session: LiveSession | null;
    isConnecting: boolean;
    userTranscriptPreview: string | null;
    onClose: () => void;
    isSpeaking: boolean;
}

const SidebarVoicePanel: React.FC<SidebarVoicePanelProps> = ({ session, isConnecting, userTranscriptPreview, onClose, isSpeaking }) => {
    const [aiVol, setAiVol] = useState(0);

    useEffect(() => {
        let rafId: number;
        const loop = () => {
            if (session) {
                const outputVol = session.getOutputVolume();
                const inputVol = session.getInputVolume();
                const combinedVol = Math.max(outputVol, isSpeaking ? inputVol * 1.5 : 0); 
                setAiVol(prev => prev * 0.85 + combinedVol * 0.15);
            }
            rafId = requestAnimationFrame(loop);
        };
        loop();
        return () => cancelAnimationFrame(rafId);
    }, [session, isSpeaking]);

    return (
        <div className="flex flex-col gap-2 p-3 bg-slate-900/90 rounded-2xl border border-indigo-500/30 shadow-2xl animate-in slide-in-from-bottom-4 relative overflow-hidden group">
            
            <div className={`absolute top-0 left-0 w-full h-full bg-gradient-to-br from-indigo-900/20 to-purple-900/20 transition-opacity duration-1000 ${isConnecting ? 'opacity-50' : 'opacity-100'}`} />
            
            <div className="relative z-10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${isConnecting ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400 animate-ping'}`} />
                    <span className="text-[10px] font-bold text-slate-200 tracking-widest uppercase">
                        {isConnecting ? "Connecting..." : "Live"}
                    </span>
                </div>
                <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors bg-white/5 p-1 rounded-full hover:bg-white/10">
                    <X size={12}/>
                </button>
            </div>

            <div className="relative z-10 flex flex-col items-center justify-center py-1 min-h-[80px]">
                 <div 
                    className={`relative w-12 h-12 rounded-full flex items-center justify-center shadow-[0_0_20_rgba(99,102,241,0.3)] transition-all duration-300 border 
                    ${isConnecting ? 'bg-slate-800 border-slate-700' : 'bg-gradient-to-br from-indigo-600 to-purple-700 border-indigo-400/50'}`}
                    style={{ transform: `scale(${1 + Math.min(aiVol * 0.5, 0.2)})` }}
                 >
                    {isConnecting ? (
                        <Loader2 className="text-slate-500 animate-spin" size={14} />
                    ) : (
                        <div className="flex gap-0.5 items-center h-4">
                            <div className="w-0.5 bg-white/90 rounded-full" style={{ height: `${20 + aiVol * 60}%` }} />
                            <div className="w-0.5 bg-white/90 rounded-full" style={{ height: `${35 + aiVol * 80}%` }} />
                            <div className="w-0.5 bg-white/90 rounded-full" style={{ height: `${20 + aiVol * 60}%` }} />
                        </div>
                    )}
                 </div>

                 <div className="mt-2 text-center min-h-[24px] flex items-center justify-center w-full px-1">
                    {isConnecting ? (
                        <span className="text-[9px] text-indigo-300/70 font-mono animate-pulse">
                            Establishing Link...
                        </span>
                    ) : isSpeaking ? (
                        userTranscriptPreview ? (
                            <p className="text-[10px] font-medium text-white/90 leading-tight text-center bg-black/30 backdrop-blur-sm px-2 py-0.5 rounded-md border border-white/5">
                                 "{userTranscriptPreview}"
                            </p>
                        ) : (
                            <span className="text-[9px] text-indigo-300/70 font-mono animate-pulse">
                                Listening...
                            </span>
                        )
                    ) : (
                        <span className="text-[9px] text-indigo-300/70 font-mono">
                            Press and Hold
                        </span>
                    )}
                 </div>
            </div>

            <div className="relative z-10 pt-1 border-t border-white/5">
                 <button 
                    onClick={onClose}
                    className="w-full py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 rounded-lg text-[9px] font-bold uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
                 >
                    <StopCircle size={12} /> End
                 </button>
            </div>
        </div>
    );
};

// --- Module 8: Answer UI Agent (Card Component) ---
interface AnswerCardProps { 
    data: AnswerCardData; 
    onQuestionClick: (q: string) => void; 
    onRewindClick: (time: number) => void;
}

const AnswerCard: React.FC<AnswerCardProps> = ({ data, onQuestionClick, onRewindClick }) => {
    const [expandedTerm, setExpandedTerm] = useState<string | null>(null);

    const getConfidenceColor = (confidence: number | undefined) => {
        if (confidence === undefined || confidence === null) return 'text-slate-500 bg-slate-800';
        if (confidence >= 0.7) return 'text-emerald-300 bg-emerald-900/50';
        if (confidence >= 0.4) return 'text-amber-300 bg-amber-900/50';
        return 'text-red-300 bg-red-900/50';
    };

    return (
        <div className="flex flex-col gap-3">
            <div className="flex justify-between items-center border-b border-slate-600/50 pb-2 mb-1">
                <h3 className="font-bold text-brand-300 text-sm flex items-center gap-2">
                    <CheckCircle2 size={14} /> {data.title}
                </h3>
                <div className="flex items-center gap-2">
                    {data.is_voice_stream && (
                        <span className="flex items-center gap-1 text-[10px] font-medium text-brand-400 bg-brand-950/50 px-2 py-0.5 rounded-full border border-brand-500/30">
                            <Activity size={10} className="animate-pulse" /> Voice
                        </span>
                    )}
                    {data.confidence !== undefined && (
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${getConfidenceColor(data.confidence)}`}>
                            Confidence: {Math.round((data.confidence || 0) * 100)}%
                        </span>
                    )}
                </div>
            </div>

            <div className="markdown-body text-slate-200 text-sm">
                <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                    {data.answer}
                </ReactMarkdown>
            </div>

            {data.key_terms && data.key_terms.length > 0 && (
                <div className="bg-slate-900/50 rounded-lg p-2 mt-1 border border-slate-700/50">
                    <p className="text-[10px] uppercase font-bold text-slate-500 mb-2">Key Concepts</p>
                    <div className="space-y-2">
                        {data.key_terms.map((term, idx) => (
                            <div key={idx} className="text-xs">
                                <button 
                                    onClick={() => setExpandedTerm(expandedTerm === term.term ? null : term.term)}
                                    className="flex items-center gap-1 font-mono text-brand-400 hover:text-brand-300 text-left w-full"
                                >
                                    {expandedTerm === term.term ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                                    {term.term}
                                </button>
                                {expandedTerm === term.term && (
                                    <p className="pl-4 pt-1 text-slate-400 italic">{term.definition}</p>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {data.suggested_rewind_time !== undefined && data.suggested_rewind_time >= 0 && (
                <button
                    onClick={() => onRewindClick(data.suggested_rewind_time!)}
                    className="mt-2 py-2 px-3 bg-indigo-600/20 text-indigo-300 rounded-lg border border-indigo-500/30 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-indigo-600/30 transition-colors"
                >
                    <Clock size={14} /> Rewatch: {formatTime(data.suggested_rewind_time)}
                </button>
            )}

            {data.suggested_followups && (
                <div className="mt-2 flex flex-wrap gap-2">
                    {data.suggested_followups.map((q, idx) => (
                        <button 
                            key={idx} 
                            onClick={() => onQuestionClick(q)}
                            className="text-[10px] bg-brand-900/30 text-brand-200 px-2 py-1 rounded-full border border-brand-800/50 cursor-pointer hover:bg-brand-900/50 hover:border-brand-500/50 transition-colors text-left"
                        >
                            {q}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

const PlayerView: React.FC<PlayerViewProps> = ({ onNavigate, session, onUpdateSession }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [preciseTime, setPreciseTime] = useState(0); 
  const [duration, setDuration] = useState(0);
  const [videoSrc, setVideoSrc] = useState(DEFAULT_VIDEO);
  const [isHudOpen, setIsHudOpen] = useState(true);
  const [hudPosition, setHudPosition] = useState<{x: number, y: number} | null>(null);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingPoints, setDrawingPoints] = useState<Point[]>([]); 
  const [mode, setMode] = useState<'view' | 'draw'>('view');
  
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>(session?.chatHistory || []);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [userScrolledUp, setUserScrolledUp] = useState(false);
  
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [hasMicPermission, setHasMicPermission] = useState<boolean | null>(null);
  
  const [volume, setVolume] = useState(1.0);
  const [isMuted, setIsMuted] = useState(false);
  
  const [currentUserLiveTranscriptPreview, setCurrentUserLiveTranscriptPreview] = useState<string | null>(null);
  
  const [fullImageModalOpen, setFullImageModalOpen] = useState(false);
  const [fullImageSrc, setFullImageSrc] = useState('');
  
  const [showSubtitles, setShowSubtitles] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(400);

  const liveSessionRef = useRef<LiveSession | null>(null);
  const frameIntervalRef = useRef<number | null>(null);
  const currentLiveModelMessageIdRef = useRef<string | null>(null);
  const dragOffsetRef = useRef<{x: number, y: number}>({ x: 0, y: 0 });

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null); 
  const containerRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const hudContainerRef = useRef<HTMLDivElement>(null);

  const semanticData = session?.semanticData || MOCK_SCENE_DATA;

  const { currentScene, currentLine, activeActions, currentSceneScriptLines } = useMemo(() => {
    const scene = semanticData.scenes.find(s => preciseTime >= s.start_time && preciseTime < s.end_time);
    const line = scene?.lines.find(l => preciseTime >= l.start_s && preciseTime < l.end_s);
    
    const actions = scene?.actions.filter(a => {
        const isActive = preciseTime >= a.start_s && preciseTime < (a.start_s + a.duration_s);
        return isActive;
    }) || [];

    return { currentScene: scene, currentLine: line, activeActions: actions, currentSceneScriptLines: scene?.lines || [] };
  }, [preciseTime, semanticData]);

  const scriptWindowText = useMemo(() => {
    if (!currentScene) return "";
    const currentLineIndex = currentScene.lines.findIndex(l => preciseTime >= l.start_s && preciseTime < l.end_s);
    
    if (currentLineIndex === -1 && currentScene.lines.length > 0) {
      return currentScene.lines.slice(0, 2).map(l => l.text).join('\n');
    }
    
    const startIdxS = Math.max(0, currentLineIndex - 1);
    const endIdxS = Math.min(currentScene.lines.length, currentLineIndex + 2);
    return currentScene.lines.slice(startIdxS, endIdxS).map(l => l.text).join('\n');
  }, [currentScene, preciseTime]);

  useEffect(() => {
    const requestMic = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(track => track.stop());
            setHasMicPermission(true);
        } catch (err) {
            setHasMicPermission(false);
        }
    };
    requestMic();
  }, []);

  useEffect(() => {
    if (session?.videoUrl) {
        setVideoSrc(session.videoUrl);
        setIsPlaying(false);
    } else if (session?.videoFile) {
      const url = URL.createObjectURL(session.videoFile);
      setVideoSrc(url);
      setIsPlaying(false);
      return () => URL.revokeObjectURL(url);
    }
  }, [session?.id, session?.videoFile, session?.videoUrl]);

  useEffect(() => {
    if (session) setChatHistory(session.chatHistory);
  }, [session]);

  useEffect(() => {
    if (session && chatHistory !== session.chatHistory) {
        onUpdateSession(session.id, chatHistory);
    }
  }, [chatHistory, session, onUpdateSession]);

  useEffect(() => {
    if (isLiveActive || !userScrolledUp || chatHistory.length <= 1) {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [chatHistory, isLoading, userScrolledUp, isLiveActive, currentUserLiveTranscriptPreview]);

  useEffect(() => {
    let animationFrameId: number;
    const loop = () => {
      if (videoRef.current) {
        setPreciseTime(videoRef.current.currentTime);
      }
      animationFrameId = requestAnimationFrame(loop);
    };

    if (isPlaying) {
      loop();
    } else {
        if (videoRef.current) setPreciseTime(videoRef.current.currentTime);
    }

    return () => cancelAnimationFrame(animationFrameId);
  }, [isPlaying]);

  useEffect(() => {
      if (videoRef.current) {
          videoRef.current.playbackRate = playbackRate;
      }
  }, [playbackRate]);

  const handleChatScroll = () => {
      const container = chatContainerRef.current;
      if (!container) return;
      const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 50;
      setUserScrolledUp(!isAtBottom);
  };

  useEffect(() => {
    return () => {
      stopLiveSession();
    };
  }, []);

  useEffect(() => {
      if (videoRef.current) {
          videoRef.current.volume = isMuted ? 0 : volume;
          videoRef.current.muted = isMuted;
      }
  }, [volume, isMuted]);

  const stopLiveSession = () => {
    if (frameIntervalRef.current) {
        window.clearInterval(frameIntervalRef.current);
        frameIntervalRef.current = null;
    }
    setIsLiveActive(false);
    setIsConnecting(false);
    setIsSpeaking(false);
    setCurrentUserLiveTranscriptPreview(null);
    currentLiveModelMessageIdRef.current = null;

    if (liveSessionRef.current) {
        try {
            liveSessionRef.current.disconnect(); 
        } catch(e) { console.warn("Error disconnecting session", e); }
        liveSessionRef.current = null;
    }
  };

  const togglePlay = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (mode === 'draw' && e?.type === 'click' && (e.target as HTMLElement).tagName === 'VIDEO') return;
    if (videoRef.current) {
      if (isPlaying) videoRef.current.pause();
      else {
          if (drawingPoints.length > 0) setDrawingPoints([]);
          videoRef.current.play().catch(console.warn);
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
      setPreciseTime(time);
    }
  };

  const handleVideoSeek = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
      setPreciseTime(time);
      if (!isPlaying) {
          videoRef.current.play().catch(console.warn);
          setIsPlaying(true);
      }
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVol = parseFloat(e.target.value);
    setVolume(newVol);
    if (isMuted && newVol > 0) setIsMuted(false);
  };

  const toggleMute = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setIsMuted(!isMuted);
  };

  const cyclePlaybackRate = () => {
      const currentIndex = PLAYBACK_RATES.indexOf(playbackRate);
      const nextIndex = (currentIndex + 1) % PLAYBACK_RATES.length;
      setPlaybackRate(PLAYBACK_RATES[nextIndex]);
  };

  const toggleDrawingMode = () => {
      const newMode = mode === 'draw' ? 'view' : 'draw';
      setMode(newMode);
      if (newMode === 'draw' && videoRef.current && !videoRef.current.paused) {
          videoRef.current.pause();
          setIsPlaying(false);
      }
  };

  const getBoundingBox = (points: Point[]): SelectionBox | null => {
      if (points.length < 2) return null;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      points.forEach(p => {
          if (p.x < minX) minX = p.x;
          if (p.y < minY) minY = p.y;
          if (p.x > maxX) maxX = p.x;
          if (p.y > maxY) maxY = p.y;
      });
      return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  };

  const getFrameAsBase64 = (box: SelectionBox | null): string | null => {
    if (!videoRef.current || !canvasRef.current || !containerRef.current) return null;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    if (box) {
        const scaleX = canvas.width / containerRef.current.clientWidth;
        const scaleY = canvas.height / containerRef.current.clientHeight;

        ctx.strokeStyle = '#0ea5e9';
        ctx.lineWidth = 4;
        ctx.setLineDash([10, 5]);
        ctx.strokeRect(box.x * scaleX, box.y * scaleY, box.width * scaleX, box.height * scaleY);
        ctx.setLineDash([]);
        
        ctx.fillStyle = 'rgba(14, 165, 233, 0.2)';
        ctx.fillRect(box.x * scaleX, box.y * scaleY, box.width * scaleX, box.height * scaleY);
    }
    
    return canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (mode !== 'draw' || !containerRef.current) return;
    e.stopPropagation(); 
    setDrawingPoints([]);
    const rect = containerRef.current.getBoundingClientRect();
    setIsDrawing(true);
    setDrawingPoints([{ x: e.clientX - rect.left, y: e.clientY - rect.top }]);
    if (videoRef.current && !videoRef.current.paused) {
        videoRef.current.pause();
        setIsPlaying(false);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing || mode !== 'draw' || !containerRef.current) return;
    e.stopPropagation();
    const rect = containerRef.current.getBoundingClientRect();
    setDrawingPoints(prev => [...prev, { x: e.clientX - rect.left, y: e.clientY - rect.top }]);
  };

  const handleMouseUp = async (e: React.MouseEvent) => {
    if (!isDrawing) return;
    e.stopPropagation();
    setIsDrawing(false);
    if (videoRef.current) {
        videoRef.current.pause();
        setIsPlaying(false);
    }
    const finalPoints = [...drawingPoints];
    const boundingBox = getBoundingBox(finalPoints);

    if (boundingBox && (boundingBox.width > 20 || boundingBox.height > 20)) {
         await handleTextQuery("What is this?", finalPoints, boundingBox);
    }
    setDrawingPoints([]);
  };
  
  const openFullImageModal = (src: string) => {
    setFullImageSrc(src);
    setFullImageModalOpen(true);
  };


  const startHudDrag = (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      
      const container = hudContainerRef.current;
      const videoArea = containerRef.current; 
      if (!container || !videoArea) return;
      
      const containerRect = container.getBoundingClientRect();
      const videoRect = videoArea.getBoundingClientRect();
      
      const offsetX = e.clientX - containerRect.left;
      const offsetY = e.clientY - containerRect.top;
      dragOffsetRef.current = { x: offsetX, y: offsetY };
      
      const handleMouseMove = (moveEvent: MouseEvent) => {
           let newLeft = moveEvent.clientX - videoRect.left - dragOffsetRef.current.x;
           let newTop = moveEvent.clientY - videoRect.top - dragOffsetRef.current.y;

           const maxLeft = videoRect.width - containerRect.width;
           const maxTop = videoRect.height - 40;

           newLeft = Math.max(0, Math.min(newLeft, maxLeft));
           newTop = Math.max(0, Math.min(newTop, maxTop));
           
           setHudPosition({ x: newLeft, y: newTop });
      };
      
      const handleMouseUp = () => {
           document.removeEventListener('mousemove', handleMouseMove);
           document.removeEventListener('mouseup', handleMouseUp);
      };
      
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
  };

  const captureAndSendFrameToLive = () => {
    if (!liveSessionRef.current) return;
    const base64 = getFrameAsBase64(null);
    if (base64) liveSessionRef.current.sendImage(base64); // sendImage method will be available on LiveSession
  };

  const handleTextQuery = async (queryText: string, points = drawingPoints, bbox = getBoundingBox(drawingPoints)) => {
    if (!queryText.trim() || !videoRef.current) return;
    
    const videoCurrentTime = videoRef.current.currentTime;
    const annotatedImageBase64 = getFrameAsBase64(bbox);

    const getScriptWindow = (lines: SceneData['lines'], time: number, numLinesAround: number): string => {
      if (!lines || lines.length === 0) return "";
      
      const currentLineIndex = lines.findIndex(l => time >= l.start_s && time < l.end_s);
      
      if (currentLineIndex === -1) {
        return lines.slice(0, numLinesAround * 2 - 1).map(l => l.text).join('\n');
      }

      const startIdx = Math.max(0, currentLineIndex - numLinesAround);
      const endIdx = Math.min(lines.length, currentLineIndex + numLinesAround + 1);
      
      return lines.slice(startIdx, endIdx).map(l => l.text).join('\n');
    };

    const allContextBundles: Record<ContextTier, ContextualBundle> = {
      [ContextTier.S]: {
        tier: ContextTier.S,
        clipRange: { start: Math.max(0, videoCurrentTime - 5), end: Math.min(duration, videoCurrentTime + 5) },
        scriptWindow: getScriptWindow(currentSceneScriptLines, videoCurrentTime, 1)
      },
      [ContextTier.M]: {
        tier: ContextTier.M,
        clipRange: { start: Math.max(0, videoCurrentTime - 10), end: Math.min(duration, videoCurrentTime + 10) },
        scriptWindow: getScriptWindow(currentSceneScriptLines, videoCurrentTime, 2)
      },
      [ContextTier.L]: {
        tier: ContextTier.L,
        clipRange: { start: Math.max(0, videoCurrentTime - 20), end: Math.min(duration, videoCurrentTime + 20) },
        scriptWindow: getScriptWindow(currentSceneScriptLines, videoCurrentTime, 3)
      }
    };

    const commonContext = {
      selection: bbox,
      timestamp: videoCurrentTime,
      image: annotatedImageBase64 || undefined,
    };

    const userMsgId = Date.now().toString();
    const optimisticUserMessage: ChatMessage = {
        id: userMsgId,
        role: 'user',
        content: queryText,
        timestamp: Date.now(),
        contextualImage: commonContext.image,
        videoTimestamp: videoCurrentTime,
    };

    setChatHistory(prev => [...prev, optimisticUserMessage]);
    setInputText("");
    setDrawingPoints([]);
    setIsLoading(true);
    setIsRetrying(false);

    try {
      const { answer: responseData, finalTier } = await orchestrateQnA(
        queryText,
        { ...commonContext, currentTier: ContextTier.S, contextualBundle: allContextBundles[ContextTier.S] },
        semanticData
      );

      setChatHistory(prev => {
          const updatedHistory = prev.map(msg => 
              msg.id === userMsgId 
              ? { ...msg, contextTierUsed: finalTier, contextualClipRange: allContextBundles[finalTier || ContextTier.S].clipRange, contextualScriptWindow: allContextBundles[finalTier || ContextTier.S].scriptWindow }
              : msg
          );

          return [...updatedHistory, {
              id: (Date.now() + 1).toString(),
              role: 'model',
              content: responseData, 
              timestamp: Date.now()
          }];
      });
    } catch (error: any) {
        const errorMessage: AnswerCardData = {
            title: "An Error Occurred",
            answer: "Sorry, I couldn't process that request. Please try again in a moment."
        };
        
        if (error.message === 'RATE_LIMIT_EXCEEDED') {
            errorMessage.title = "Quota Limit Exceeded";
            errorMessage.answer = "All available model tiers are currently quota-limited. This often resets every minute. Please wait 60 seconds and try again.";
        }
        
        setChatHistory(prev => [...prev, {
            id: (Date.now() + 1).toString(),
            role: 'model',
            content: errorMessage,
            timestamp: Date.now()
        }]);
    } finally {
        setIsLoading(false);
        setIsRetrying(false);
    }
  };

  const handleStartSpeaking = () => {
    if (liveSessionRef.current) {
      liveSessionRef.current.startInputAudio();
      setIsSpeaking(true);
      
      const currentVideoTime = videoRef.current ? videoRef.current.currentTime : 0;
      const contextualImage = getFrameAsBase64(null);

      setChatHistory(prev => {
        const messageId = liveSessionRef.current?.getCurrentInputMessageId() || Date.now().toString();
        if (!prev.find(msg => msg.id === messageId && msg.role === 'user')) {
          return [...prev, {
            id: messageId,
            role: 'user',
            content: '',
            timestamp: Date.now(),
            isVoice: true,
            videoTimestamp: currentVideoTime,
            contextualImage: contextualImage || undefined
          }];
        }
        return prev;
      });
    }
  };

  const handleStopSpeaking = () => {
    if (liveSessionRef.current) {
      liveSessionRef.current.stopInputAudio();
      setIsSpeaking(false);
    }
  };

  const toggleLiveMode = async () => {
    if (isLiveActive) {
      stopLiveSession();
    } else {
      if (!isApiKeyAvailable()) { alert("API Key missing."); return; }
      if (hasMicPermission === false) { alert("Mic permission denied."); return; }

      setIsConnecting(true);
      try {
        const newLiveSession = new LiveSession(
            (update) => {
                const { text, structuredData, isUser, messageId, isTurnComplete } = update;

                if (isUser && text) {
                     if (!isTurnComplete) {
                        setCurrentUserLiveTranscriptPreview(prevTranscript => (prevTranscript || "") + text); 
                     } else {
                        setCurrentUserLiveTranscriptPreview(null);
                     }
                }

                setChatHistory(prev => {
                   const newHistory = [...prev];
                   const existingMsgIndex = newHistory.findIndex(m => m.id === messageId);
                   
                   if (existingMsgIndex !== -1) {
                       const existingMsg = newHistory[existingMsgIndex];
                       let newContent = existingMsg.content;
                       
                       if (structuredData) {
                            newContent = { 
                                title: structuredData.title, 
                                answer: structuredData.key_points.map(p => `• ${p}`).join('\n'),
                                suggested_rewind_time: structuredData.suggested_rewind_time,
                                is_voice_stream: true
                            } as AnswerCardData;
                       } else if (text) {
                           if (isUser) {
                               newContent = (typeof existingMsg.content === 'string' ? existingMsg.content : '') + text;
                           } else {
                               if (typeof newContent === 'string') {
                                   newContent = newContent + text;
                               }
                           }
                       }
                       newHistory[existingMsgIndex] = { ...existingMsg, content: newContent };
                   } else {
                       if (!isUser) {
                            const content = structuredData ? {
                                title: structuredData.title, 
                                answer: structuredData.key_points.map(p => `• ${p}`).join('\n'),
                                suggested_rewind_time: structuredData.suggested_rewind_time,
                                is_voice_stream: true
                            } : (text || '');
                            
                            newHistory.push({
                                id: messageId,
                                role: 'model',
                                content: content as any,
                                timestamp: Date.now(),
                                isVoice: true
                            });
                       } else if (isUser && text) {
                           newHistory.push({
                               id: messageId,
                               role: 'user',
                               content: text,
                               timestamp: Date.now(),
                               isVoice: true
                           });
                       }
                   }
                   return newHistory;
                });
            },
            () => { 
                stopLiveSession();
            }
        );

        const liveContextInstruction = `You are discussing the video titled "${session?.videoName || 'Unknown Video'}". ` + 
                                     `Be concise, helpful, and conversational.`;
        await newLiveSession.connect(liveContextInstruction); 
        
        liveSessionRef.current = newLiveSession;
        setIsLiveActive(true);
        setIsConnecting(false);
        
        frameIntervalRef.current = window.setInterval(captureAndSendFrameToLive, 1500);
      } catch (err) {
        console.error(err);
        setIsConnecting(false);
      }
    }
  };
  
  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = sidebarWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = startX - moveEvent.clientX;
      const newWidth = startWidth + dx;
      const minWidth = 320;
      const maxWidth = 800;
      if (newWidth >= minWidth && newWidth <= maxWidth) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const getSvgPath = () => {
      if (drawingPoints.length === 0) return "";
      const d = drawingPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
      return d;
  };

  const clearDrawing = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setDrawingPoints([]);
  };

  return (
    <div className="flex h-full bg-slate-900 text-white overflow-hidden relative">
      <div className="absolute top-4 left-4 z-50 flex items-center gap-3">
        <button onClick={() => onNavigate(AppView.GENERATOR)} className="bg-black/50 hover:bg-black/70 p-2 rounded-full text-white backdrop-blur-sm transition flex items-center gap-2 pr-4">
          <ArrowLeft size={20} /> <span className="text-sm font-medium">Project</span>
        </button>
        <div className={`px-3 py-1.5 rounded-full backdrop-blur-sm border flex items-center gap-2 text-xs font-medium ${hasMicPermission ? 'bg-green-500/20 border-green-500/30 text-green-200' : 'bg-red-500/20 border-red-500/30 text-red-200'}`}>
            {hasMicPermission ? <><CheckCircle2 size={12}/> Mic Ready</> : <><AlertCircle size={12}/> Check Mic</>}
        </div>
      </div>
      <canvas ref={canvasRef} className="hidden" />

      {/* Main Content */}
      <div className="flex flex-1 h-full min-w-0">
        {/* Video Player */}
        <div className="flex-1 relative flex flex-col justify-center bg-black overflow-hidden" ref={containerRef} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>
          <div className="relative flex-1 flex items-center justify-center overflow-hidden">
            <video ref={videoRef} src={videoSrc} className="w-full h-full object-contain" onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)} onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)} controls={false} onClick={togglePlay} crossOrigin="anonymous"/>
            
            {/* HUD */}
            <div 
              ref={hudContainerRef}
              className={`absolute z-30 flex flex-col items-end gap-3 w-72 transition-opacity duration-300 ${isHudOpen ? '' : 'pointer-events-none'}`}
              style={hudPosition ? { left: hudPosition.x, top: hudPosition.y } : { top: '5rem', right: '1.5rem' }}
            >
                <div 
                  onMouseDown={startHudDrag}
                  className="bg-slate-900/80 backdrop-blur-md border border-slate-700/50 rounded-xl px-4 py-3 shadow-2xl flex items-center justify-between gap-3 w-full pointer-events-auto transition-all hover:bg-slate-900/90 cursor-move"
                >
                    <div className="flex items-center gap-3 pointer-events-none">
                        <Clock size={18} className="text-brand-500" />
                        <span className="font-mono text-xl font-bold text-white tabular-nums tracking-tight leading-none">
                            <span className="text-slate-500 font-medium text-sm mr-1.5">t=</span>
                            {preciseTime.toFixed(3)}
                            <span className="text-slate-500 text-sm font-medium ml-1">s</span>
                        </span>
                    </div>
                    <button 
                        onClick={(e) => { e.stopPropagation(); setIsHudOpen(!isHudOpen); }}
                        onMouseDown={(e) => e.stopPropagation()}
                        className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                        title={isHudOpen ? "Hide Details" : "Show Details"}
                    >
                        {isHudOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                </div>

                <div className={`flex flex-col gap-3 w-full transition-all duration-300 ${isHudOpen ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none h-0 overflow-hidden'}`}>
                    {currentScene && (
                        <div 
                          onMouseDown={startHudDrag}
                          className="bg-slate-900/80 backdrop-blur-md border border-slate-700/50 rounded-xl px-4 py-3 shadow-2xl w-full cursor-move pointer-events-auto"
                        >
                            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-700/50 pointer-events-none">
                                <LayoutTemplate size={14} className="text-purple-400" />
                                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Scene {currentScene.scene_id}</span>
                            </div>
                            <h3 className="font-bold text-sm text-white leading-tight mb-1 pointer-events-none">{currentScene.visual_context.layout.strategy_name}</h3>
                            <p className="text-[10px] text-slate-400 leading-relaxed line-clamp-2 pointer-events-none">{currentScene.visual_context.layout.description}</p>
                        </div>
                    )}
                    {scriptWindowText && (
                        <div 
                            onMouseDown={startHudDrag}
                            className="bg-slate-900/80 backdrop-blur-md border border-slate-700/50 rounded-xl px-4 py-3 shadow-2xl w-full cursor-move pointer-events-auto"
                        >
                            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-700/50 pointer-events-none">
                                <ClipboardEdit size={14} className="text-yellow-400" />
                                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Script Context</span>
                            </div>
                            <p className="text-[10px] text-slate-300 leading-relaxed font-mono pointer-events-none whitespace-pre-wrap">
                                {scriptWindowText}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Subtitles */}
            {showSubtitles && currentLine && (
                <div className="absolute bottom-24 left-1/2 transform -translate-x-1/2 max-w-2xl w-full px-6 text-center pointer-events-none z-30">
                     <div className="inline-block bg-black/60 backdrop-blur-sm px-6 py-3 rounded-2xl shadow-lg border border-white/10 animate-in slide-in-from-bottom-2 fade-in duration-300">
                         <p className="text-lg md:text-xl font-medium text-white drop-shadow-md leading-relaxed">
                            <ReactMarkdown components={{p: ({children}) => <>{children}</>}}>{currentLine.text}</ReactMarkdown>
                         </p>
                     </div>
                </div>
            )}

            <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
                <path d={getSvgPath()} stroke="#0ea5e9" strokeWidth="3" fill="rgba(14, 165, 233, 0.1)" strokeLinecap="round" strokeLinejoin="round" className="drop-shadow-lg"/>
            </svg>
            {drawingPoints.length > 0 && <button onClick={clearDrawing} className="absolute top-4 right-4 z-30 bg-black/50 p-2 rounded-full pointer-events-auto hover:bg-black/70 transition-colors"><Eraser size={16} /></button>}
          </div>

          {/* Controls */}
          <div className="h-16 bg-gradient-to-t from-black/90 to-transparent px-6 flex items-center gap-4 z-20 shrink-0">
             <button onClick={togglePlay} className="text-white hover:text-brand-400 transition-colors">{isPlaying ? <Pause size={24}/> : <Play size={24}/>}</button>
             <div className="flex-1 flex items-center gap-3">
                <span className="text-xs font-mono text-slate-300 w-10 text-right">{formatTime(currentTime)}</span>
                <input type="range" min="0" max={duration || 100} value={currentTime} onChange={handleSeek} className="flex-1 h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:bg-brand-500 hover:[&::-webkit-slider-thumb]:bg-brand-400 transition-all"/>
                <span className="text-xs font-mono text-slate-300 w-10">{formatTime(duration)}</span>
             </div>

             <div className="flex items-center gap-2 mx-2">
                 <button onClick={toggleMute} className="text-white hover:text-brand-400 transition-colors p-1">
                     {isMuted || volume === 0 ? <VolumeX size={20}/> : <Volume2 size={20}/>}
                 </button>
                 <div className="w-20 flex items-center">
                     <input type="range" min="0" max="1" step="0.05" value={isMuted ? 0 : volume} onChange={handleVolumeChange} className="w-full h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:bg-brand-500 hover:[&::-webkit-slider-thumb]:bg-brand-400 transition-all"/>
                 </div>
             </div>

             <div className="flex items-center gap-1 group/speed relative">
                <button 
                    onClick={cyclePlaybackRate} 
                    className="text-white hover:text-brand-400 transition-colors p-1.5 rounded-lg hover:bg-white/5 flex items-center gap-1.5 border border-transparent hover:border-white/10 active:scale-95 transition-all"
                    title="Cycle Playback Speed"
                >
                    <Gauge size={20}/>
                    <span className="text-[10px] font-bold w-8 text-left">{playbackRate}x</span>
                </button>
             </div>
             
             <button onClick={() => setShowSubtitles(!showSubtitles)} className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${showSubtitles ? 'bg-brand-600 text-white shadow-lg' : 'bg-white/10 text-slate-300 hover:bg-white/20'}`}>
                <Subtitles size={18} />
             </button>
             <button onClick={toggleDrawingMode} className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${mode === 'draw' ? 'bg-brand-600 text-white shadow-lg' : 'bg-white/10 text-slate-300 hover:bg-white/20'}`}>
                <BoxSelect size={18} /> {mode === 'draw' ? 'Drawing' : 'Draw'}
             </button>
          </div>
        </div>

        {/* Resizer Handle */}
        <div 
          onMouseDown={handleResizeMouseDown}
          className="w-1.5 bg-slate-800 hover:bg-brand-500 transition-colors duration-200 cursor-col-resize shrink-0"
        />

        {/* Sidebar: Q&A */}
        <div style={{ width: `${sidebarWidth}px` }} className="bg-slate-900 flex flex-col shadow-2xl z-40 shrink-0 h-full max-h-screen">
           <div className="p-4 border-b border-slate-800 bg-slate-900/95 backdrop-blur flex justify-between items-center shrink-0">
             <div>
                <h2 className="text-lg font-semibold flex items-center gap-2"><MessageSquare size={18} className="text-brand-400"/> {session?.videoName || "Session"}</h2>
             </div>
           </div>

           <div ref={chatContainerRef} onScroll={handleChatScroll} className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-700">
             {chatHistory.length === 0 && <div className="text-center text-slate-500 mt-10 text-sm">Use <b>Draw</b> to circle an area on the video to ask specific questions.</div>}
             
             {chatHistory.map((msg) => (
               <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                 <div className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm transition-all ${msg.role === 'user' ? 'bg-brand-600 text-white rounded-br-none' : 'bg-slate-800 text-slate-200 rounded-bl-none border border-slate-700'} ${msg.isVoice ? 'ring-2 ring-brand-400/30' : ''}`}>
                   
                   {msg.role === 'user' && (
                        <div className="flex items-center justify-between mb-2 pb-1 border-b border-white/10">
                            <div className="flex items-center gap-2">
                                {msg.isVoice ? (
                                    <span className="text-[10px] uppercase font-bold tracking-wider opacity-70 flex items-center gap-1"><Activity size={10} className="animate-pulse" /> Live Voice</span>
                                ) : (
                                    <span className="text-[10px] uppercase font-bold tracking-wider opacity-70 flex items-center gap-1"><MessageSquare size={10} /> Text</span>
                                )}
                            </div>
                            {msg.videoTimestamp !== undefined && (
                                <button 
                                    onClick={() => handleVideoSeek(msg.videoTimestamp!)}
                                    className="text-[10px] font-mono opacity-60 hover:opacity-100 hover:text-brand-200 flex items-center gap-1 transition-colors"
                                    title="Jump to video time"
                                >
                                    <Clock size={10} /> {formatTime(msg.videoTimestamp)}
                                </button>
                            )}
                        </div>
                   )}
                   
                   {/* Screenshot (Contextual Image) Rendering Block */}
                   {msg.role === 'user' && (msg.contextualImage || msg.contextualClipRange || msg.contextualScriptWindow) && (
                        <div className="mb-2 p-2 bg-white/10 rounded-lg border border-white/5 text-slate-300">
                            {msg.contextTierUsed && <p className="text-[10px] uppercase font-bold text-white/50 mb-1">Tier {msg.contextTierUsed}</p>}
                            {msg.contextualImage && (
                                <div className="mb-1">
                                    <img 
                                        src={`data:image/jpeg;base64,${msg.contextualImage}`} 
                                        alt="Contextual Frame" 
                                        className="w-full max-h-32 object-contain rounded-md border border-white/10 cursor-pointer hover:opacity-90 transition-opacity" 
                                        onClick={() => openFullImageModal(`data:image/jpeg;base64,${msg.contextualImage}`)}
                                    />
                                    <span className="text-[9px] text-white/70 block mt-1">Click to enlarge</span>
                                </div>
                            )}
                            {msg.contextualClipRange && (
                                <p className="text-[10px] font-mono mb-1">
                                    Clip: {formatTime(msg.contextualClipRange.start)} ~ {formatTime(msg.contextualClipRange.end)}
                                </p>
                            )}
                            {msg.contextualScriptWindow && (
                                <div className="text-[10px] font-mono whitespace-pre-wrap max-h-16 overflow-y-auto scrollbar-hide border-t border-white/10 pt-1 mt-1">
                                    {msg.contextualScriptWindow}
                                </div>
                            )}
                        </div>
                   )}
                   
                   {typeof msg.content === 'string' ? (
                       <div className="markdown-body">
                           <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{msg.content}</ReactMarkdown>
                       </div>
                   ) : (
                       <AnswerCard 
                           data={msg.content as AnswerCardData} 
                           onQuestionClick={(q) => handleTextQuery(q)}
                           onRewindClick={handleVideoSeek}
                       />
                   )}
                 </div>
               </div>
             ))}
             {isLoading && (
                <div className="flex justify-start">
                    <div className="bg-slate-800 text-slate-400 rounded-2xl px-4 py-3 text-sm flex items-center gap-2">
                        <Loader2 size={14} className="animate-spin"/> 
                        {isRetrying ? "Switching to backup tier..." : "Analyzing context..."}
                    </div>
                </div>
             )}
             <div ref={chatEndRef} />
           </div>

           <div className="p-4 border-t border-slate-800 bg-slate-900 shrink-0">
             {isLiveActive || isConnecting ? (
                 <>
                    <SidebarVoicePanel 
                        session={liveSessionRef.current} 
                        isConnecting={isConnecting} 
                        userTranscriptPreview={currentUserLiveTranscriptPreview}
                        onClose={toggleLiveMode}
                        isSpeaking={isSpeaking}
                    />
                    {!isConnecting && (
                      <button 
                         onMouseDown={handleStartSpeaking}
                         onMouseUp={handleStopSpeaking}
                         onMouseLeave={handleStopSpeaking}
                         className={`w-full mt-3 py-3 rounded-xl font-bold text-white transition-all shadow-lg flex items-center justify-center gap-2 
                           ${isSpeaking ? 'bg-red-600 shadow-red-500/30' : 'bg-brand-600 hover:bg-brand-700 shadow-brand-500/20'} 
                           disabled:opacity-50 disabled:cursor-not-allowed select-none`}
                         disabled={isConnecting}
                      >
                         <HandIcon size={18} className={isSpeaking ? 'animate-bounce' : ''} />
                         {isSpeaking ? 'Speaking...' : 'Hold to Speak'}
                      </button>
                    )}
                 </>
             ) : (
                 <>
                    <div className="flex items-center gap-2 mb-2">
                        <button onClick={toggleLiveMode} disabled={isConnecting} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${isLiveActive ? 'bg-red-500/10 text-red-500 border border-red-500/50' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'} disabled:opacity-50 disabled:cursor-not-allowed`}>
                        {isConnecting ? <><Loader2 size={16} className="animate-spin"/> Connecting...</> : isLiveActive ? "Stop Voice Session" : <><Mic size={16} /> Start Live Voice</>}
                        </button>
                    </div>
                    <div className="relative">
                        <input type="text" value={inputText} onChange={(e) => setInputText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleTextQuery(inputText)} placeholder="Ask a question..." className="w-full bg-slate-800 text-white rounded-lg pl-4 pr-12 py-3 text-sm focus:ring-2 focus:ring-brand-500 outline-none placeholder-slate-500" disabled={isLiveActive || isConnecting}/>
                        <button onClick={() => handleTextQuery(inputText)} disabled={!inputText.trim() || isLiveActive || isConnecting} className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1.5 text-brand-400 hover:text-brand-300 disabled:text-slate-600"><Send size={18} /></button>
                    </div>
                 </>
             )}
           </div>
        </div>
      </div>
      
      {fullImageModalOpen && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4" onClick={() => setFullImageModalOpen(false)}>
            <div className="relative max-w-4xl max-h-full">
                <img src={fullImageSrc} alt="Full Size Contextual Frame" className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl border border-white/20"/>
                <button 
                    onClick={() => setFullImageModalOpen(false)}
                    className="absolute -top-4 -right-4 bg-white/20 hover:bg-white/30 text-white p-2 rounded-full backdrop-blur-sm"
                >
                    <X size={20}/>
                </button>
            </div>
        </div>
      )}
    </div>
  );
};

export default PlayerView;