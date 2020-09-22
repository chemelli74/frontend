import { mdiClose, mdiDrag } from "@mdi/js";
import {
  css,
  CSSResult,
  customElement,
  html,
  internalProperty,
  LitElement,
  property,
  PropertyValues,
  TemplateResult,
} from "lit-element";
import { guard } from "lit-html/directives/guard";
import type { SortableEvent } from "sortablejs";
import Sortable, {
  AutoScroll,
  OnSpill,
} from "sortablejs/modular/sortable.core.esm";
import { fireEvent } from "../../../common/dom/fire_event";
import "../../../components/entity/ha-entity-picker";
import type { HaEntityPicker } from "../../../components/entity/ha-entity-picker";
import "../../../components/ha-icon-button";
import { sortableStyles } from "../../../resources/ha-sortable-style";
import { HomeAssistant } from "../../../types";
import { EntityConfig, LovelaceRowConfig } from "../entity-rows/types";

@customElement("hui-entities-card-row-editor")
export class HuiEntitiesCardRowEditor extends LitElement {
  @property({ attribute: false }) protected hass?: HomeAssistant;

  @property({ attribute: false }) protected entities?: LovelaceRowConfig[];

  @property() protected label?: string;

  @internalProperty() private _attached = false;

  @internalProperty() private _renderEmptySortable = false;

  private _sortable?: Sortable;

  public connectedCallback() {
    super.connectedCallback();
    this._attached = true;
  }

  public disconnectedCallback() {
    super.disconnectedCallback();
    this._attached = false;
  }

  protected render(): TemplateResult {
    if (!this.entities || !this.hass) {
      return html``;
    }

    return html`
      <h3>
        ${this.label ||
        `${this.hass!.localize(
          "ui.panel.lovelace.editor.card.generic.entities"
        )} (${this.hass!.localize(
          "ui.panel.lovelace.editor.card.config.required"
        )})`}
      </h3>
      <div class="entities">
        ${guard([this.entities, this._renderEmptySortable], () =>
          this._renderEmptySortable
            ? ""
            : this.entities!.map((entityConf, index) => {
                return html`
                  <div class="entity">
                    <ha-svg-icon class="handle" .path=${mdiDrag}></ha-svg-icon>
                    ${entityConf.type
                      ? html`
                          <div class="special-row">
                            <div>
                              <span>
                                ${this.hass!.localize(
                                  `ui.panel.lovelace.editor.card.entities.entity_row.${entityConf.type}`
                                )}
                                ${this.hass!.localize(
                                  "ui.panel.lovelace.editor.card.entities.special_row"
                                )}
                              </span>
                              <span class="secondary"
                                >Edit row using the code editor</span
                              >
                            </div>
                            <mwc-icon-button
                              aria-label=${this.hass!.localize(
                                "ui.components.entity.entity-picker.clear"
                              )}
                              index=${index}
                              .index=${index}
                              .value=${""}
                              @click=${this._removeSpecialRow}
                            >
                              <ha-svg-icon .path=${mdiClose}></ha-svg-icon>
                            </mwc-icon-button>
                          </div>
                        `
                      : html`
                          <ha-entity-picker
                            allow-custom-entity
                            .hass=${this.hass}
                            .value=${(entityConf as EntityConfig).entity}
                            .index=${index}
                            @value-changed=${this._valueChanged}
                          ></ha-entity-picker>
                        `}
                  </div>
                `;
              })
        )}
      </div>
      <ha-entity-picker
        .hass=${this.hass}
        @value-changed=${this._addEntity}
      ></ha-entity-picker>
    `;
  }

  protected firstUpdated(): void {
    Sortable.mount(OnSpill);
    Sortable.mount(new AutoScroll());
  }

  protected updated(changedProps: PropertyValues): void {
    super.updated(changedProps);

    const attachedChanged = changedProps.has("_attached");
    const entitiesChanged = changedProps.has("entities");

    if (!entitiesChanged && !attachedChanged) {
      return;
    }

    if (attachedChanged && !this._attached) {
      // Tear down sortable, if available
      this._sortable?.destroy();
      this._sortable = undefined;
      return;
    }

    if (!this._sortable && this.entities) {
      this._createSortable();
      return;
    }

    if (entitiesChanged) {
      this._handleEntitiesChanged();
    }
  }

  private async _handleEntitiesChanged() {
    this._renderEmptySortable = true;
    await this.updateComplete;
    const container = this.shadowRoot!.querySelector(".entities")!;
    while (container.lastElementChild) {
      container.removeChild(container.lastElementChild);
    }
    this._renderEmptySortable = false;
  }

  private _createSortable() {
    this._sortable = new Sortable(this.shadowRoot!.querySelector(".entities"), {
      animation: 150,
      fallbackClass: "sortable-fallback",
      handle: ".handle",
      onEnd: async (evt: SortableEvent) => this._entityMoved(evt),
    });
  }

  private async _addEntity(ev: CustomEvent): Promise<void> {
    const value = ev.detail.value;
    if (value === "") {
      return;
    }
    const newConfigEntities = this.entities!.concat({
      entity: value as string,
    });
    (ev.target as HaEntityPicker).value = "";
    fireEvent(this, "entities-changed", { entities: newConfigEntities });
  }

  private _entityMoved(ev: SortableEvent): void {
    if (ev.oldIndex === ev.newIndex) {
      return;
    }

    const newEntities = this.entities!.concat();

    newEntities.splice(ev.newIndex!, 0, newEntities.splice(ev.oldIndex!, 1)[0]);

    fireEvent(this, "entities-changed", { entities: newEntities });
  }

  private _removeSpecialRow(ev: CustomEvent): void {
    const index = (ev.currentTarget as any).index;
    const newConfigEntities = this.entities!.concat();

    newConfigEntities.splice(index, 1);

    fireEvent(this, "entities-changed", { entities: newConfigEntities });
  }

  private _valueChanged(ev: CustomEvent): void {
    const value = ev.detail.value;
    const index = (ev.target as any).index;
    const newConfigEntities = this.entities!.concat();

    if (value === "") {
      newConfigEntities.splice(index, 1);
    } else {
      newConfigEntities[index] = {
        ...newConfigEntities[index],
        entity: value!,
      };
    }

    fireEvent(this, "entities-changed", { entities: newConfigEntities });
  }

  static get styles(): CSSResult[] {
    return [
      sortableStyles,
      css`
        .entity {
          display: flex;
          align-items: center;
        }
        .entity .handle {
          padding-right: 8px;
          cursor: move;
        }
        .entity ha-entity-picker {
          flex-grow: 1;
        }
        .special-row {
          height: 60px;
          font-size: 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-grow: 1;
        }

        .special-row div {
          display: flex;
          flex-direction: column;
        }

        .special-row mwc-icon-button {
          --mdc-icon-button-size: 36px;
          color: var(--secondary-text-color);
        }

        .secondary {
          font-size: 12px;
          color: var(--secondary-text-color);
        }
      `,
    ];
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "hui-entities-card-row-editor": HuiEntitiesCardRowEditor;
  }
}
