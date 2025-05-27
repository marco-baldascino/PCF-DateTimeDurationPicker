import { IInputs, IOutputs } from "./generated/ManifestTypes";

export class DateTimeDurationPicker implements ComponentFramework.StandardControl<IInputs, IOutputs> {
    private container: HTMLDivElement;
    private dateInput: HTMLInputElement;
    private startTimeSelect: HTMLSelectElement;
    private endTimeSelect: HTMLSelectElement;
    private context: ComponentFramework.Context<IInputs>;
    private notifyOutputChanged: () => void;

    private eventStart: Date | undefined;
    private eventEnd: Date | undefined;
    private selectedInterval: number | undefined;
    private intervalOptions: number[] = [];

    private is24Hour: boolean = true;
    private defaultToNow: boolean = true;

    //#region [   Native PCF functions   ]
    public init(
        context: ComponentFramework.Context<IInputs>,
        notifyOutputChanged: () => void,
        state: ComponentFramework.Dictionary,
        container: HTMLDivElement
    ): void {
        this.context = context;
        this.notifyOutputChanged = notifyOutputChanged;
        this.container = container;

        const intervalConfig = context.parameters.durationIntervals.raw || "30";
        this.intervalOptions = intervalConfig
            .split(",")
            .map(s => parseInt(s.trim()))
            .filter(n => !isNaN(n));

        this.is24Hour = context.parameters.timeFormat.raw === "0";
        this.defaultToNow = context.parameters.defaultToCurrentTime.raw ?? true;

        this.container.style.display = "flex";
        this.container.style.gap = "10px";
        this.container.style.alignItems = "flex-start";
        this.dateInput = document.createElement("input");
        this.dateInput.type = "date";
        this.dateInput.style.flex = "2";
        this.dateInput.style.boxSizing = "border-box";
        this.startTimeSelect = document.createElement("select");
        this.startTimeSelect.style.flex = "1";
        this.startTimeSelect.className = "time-picker";
        this.startTimeSelect.style.boxSizing = "border-box";
        this.endTimeSelect = document.createElement("select");
        this.endTimeSelect.style.flex = "1";
        this.endTimeSelect.className = "time-picker";
        this.endTimeSelect.style.boxSizing = "border-box";

        const dateBox = this.CreateLabeledContainer("Date", this.dateInput, "2");
        const startBox = this.CreateLabeledContainer("Start time", this.startTimeSelect, "1");
        const endBox = this.CreateLabeledContainer("End time", this.endTimeSelect, "1");
        this.container.appendChild(dateBox);
        this.container.appendChild(startBox);
        this.container.appendChild(endBox);

        this.dateInput.onchange = () => {
            const parts = this.dateInput.value.split("-").map(Number);
            if (parts.length === 3) {
                if (!this.eventStart) this.eventStart = new Date();
                this.eventStart.setFullYear(parts[0], parts[1] - 1, parts[2]);
                this.UpdateStartTimes();
                this.UpdateEndTimes();
                this.notifyOutputChanged();
            }
        };

        this.startTimeSelect.onchange = () => {
            if (this.startTimeSelect.value) {
                const newStart = new Date(this.startTimeSelect.value);
                const dateParts = this.dateInput.value.split("-").map(Number);
                if (dateParts.length === 3) {
                    newStart.setFullYear(dateParts[0], dateParts[1] - 1, dateParts[2]);
                }
                this.eventStart = newStart;
                this.UpdateEndTimes();
                this.notifyOutputChanged();
            }
        };

        this.endTimeSelect.onchange = () => {
            this.CalculateEndTime();
            this.notifyOutputChanged();
        };

        this.InitializeFromContext(context);
    }

    public updateView(context: ComponentFramework.Context<IInputs>): void {
        this.context = context;

        if (context.updatedProperties.includes("eventdate") && context.parameters.eventdate.raw) {
            const incoming = context.parameters.eventdate.raw;
            this.eventStart = new Date(incoming);

            const yyyy = incoming.getFullYear();
            const mm = (incoming.getMonth() + 1).toString().padStart(2, "0");
            const dd = incoming.getDate().toString().padStart(2, "0");
            this.dateInput.value = `${yyyy}-${mm}-${dd}`;

            this.UpdateStartTimes();
            this.UpdateEndTimes();
        }

        if (context.parameters.duration?.raw !== undefined) {
            this.selectedInterval = context.parameters.duration.raw ?? undefined;
        }
    }

    public getOutputs(): IOutputs {
        return {
            eventdate: this.eventStart,
            eventenddate: this.eventEnd,
            duration: this.selectedInterval
        };
    }

    public destroy(): void {
        //
    }
    //#endregion

    //#region [   Custom functions   ]
    private InitializeFromContext(context: ComponentFramework.Context<IInputs>): void {
        const rawDate = context.parameters.eventdate.raw;
        if (rawDate) {
            this.eventStart = new Date(rawDate);
        } else {
            const now = new Date();
            now.setSeconds(0, 0);
            now.setMinutes(0);
            now.setHours(this.defaultToNow ? now.getHours() : 8);
            this.eventStart = now;
        }

        const yyyy = this.eventStart.getFullYear();
        const mm = (this.eventStart.getMonth() + 1).toString().padStart(2, "0");
        const dd = this.eventStart.getDate().toString().padStart(2, "0");
        this.dateInput.value = `${yyyy}-${mm}-${dd}`;

        this.UpdateStartTimes();
        this.UpdateEndTimes();
    }

    private UpdateStartTimes(): void {
        this.startTimeSelect.innerHTML = "";

        const baseTime = this.defaultToNow
            ? new Date()
            : this.SetToHourMinute(new Date(), 8, 0);
        baseTime.setSeconds(0, 0);

        for (let mins = 0; mins < 1440; mins += 5) {
            const t = new Date();
            t.setHours(0, 0, 0, 0);
            t.setMinutes(mins);
            if (t >= baseTime) {
                const option = document.createElement("option");
                option.value = t.toISOString();
                option.textContent = this.FormatTime(t);
                this.startTimeSelect.appendChild(option);
            }
        }

        const selected = Array.from(this.startTimeSelect.options).find(opt => {
            const optTime = new Date(opt.value);
            return optTime.getHours() === this.eventStart?.getHours() &&
                   optTime.getMinutes() === this.eventStart?.getMinutes();
        });

        if (selected) {
            this.startTimeSelect.value = selected.value;
        } else if (this.startTimeSelect.options.length > 0) {
            this.startTimeSelect.selectedIndex = 0;
            this.eventStart = new Date(this.startTimeSelect.value);
        }
    }

    private UpdateEndTimes(): void {
        this.endTimeSelect.innerHTML = "";

        if (!this.eventStart) {
            this.eventEnd = undefined;
            return;
        }

        for (const interval of this.intervalOptions) {
            const end = new Date(this.eventStart.getTime() + interval * 60000);
            const opt = document.createElement("option");
            opt.value = end.toISOString();
            opt.textContent = this.FormatTime(end);
            this.endTimeSelect.appendChild(opt);
        }

        if (this.endTimeSelect.options.length > 0) {
            const match = this.intervalOptions.find(i => i === this.selectedInterval);
            const index = match ? this.intervalOptions.indexOf(match) : 0;
            this.endTimeSelect.selectedIndex = index;
            this.eventEnd = new Date(this.endTimeSelect.value);
            this.selectedInterval = this.intervalOptions[index];
        }
    }

    private CalculateEndTime(): void {
        if (!this.endTimeSelect.value) return;

        this.eventEnd = new Date(this.endTimeSelect.value);

        if (this.dateInput.value) {
            const [y, m, d] = this.dateInput.value.split("-").map(Number);
            this.eventEnd.setFullYear(y, m - 1, d);
        }

        const matchedInterval = this.intervalOptions.find(interval => {
            const compare = new Date(this.eventStart!.getTime() + interval * 60000);
            return compare.toISOString() === this.endTimeSelect.value;
        });

        if (matchedInterval !== undefined) {
            this.selectedInterval = matchedInterval;
        }
    }

    private SetToHourMinute(date: Date, hour: number, minute: number): Date {
        const result = new Date(date);
        result.setHours(hour, minute, 0, 0);
        return result;
    }

    private FormatTime(date: Date): string {
        return date.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            hour12: !this.is24Hour
        });
    }

    private CreateLabeledContainer(labelText: string, input: HTMLElement, flex: string): HTMLDivElement {
        const wrapper = document.createElement("div");
        wrapper.style.display = "flex";
        wrapper.style.flexDirection = "column";
        wrapper.style.flex = flex;

        const label = document.createElement("label");
        label.textContent = labelText;
        label.style.fontWeight = "bold";
        label.style.marginBottom = "4px";
        label.style.textAlign = "left";

        wrapper.appendChild(label);
        wrapper.appendChild(input);
        return wrapper;
    }
    //#endregion
}