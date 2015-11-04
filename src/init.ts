export interface CalendarCalculationData {
    div?: number;
    ref: string;
    mod?: number;
}
export interface CalendarLengthData {
    count: number;
    julian?: number;
    single?: Array<CalendarLengthData>;
    ref?: string;
    operation?: string;
    value?: number;
}
export interface CalendarCycleData {
    id: string;
    type: string;
    cycles: Array<CalendarCycleData>;
    lengths?: Array<CalendarLengthData>;
    ref?: string;
    value?: number;
    operation?: string;
}

/**
 * The metadata and top-level information for calendar data.
 */
export interface CalendarData {
    version: number;
    id: string;
    julian?: number;
    cycles?: Array<CalendarCycleData>;
}
export interface CultureTemporalFormatData {
    ref?: string;
    constant?: string;
    digits?: number;
    offset?: number;
}
export interface CultureTemporalData {
    calendars: Array<string>;
    formats: Array<CultureTemporalFormatData>;
}
export interface CultureData {
    id: string;
    version: number;
    temporal?: CultureTemporalData;
}
export interface CultureDataProvider {
    getCalendarData(id: string): Promise<CalendarData>;
    getCultureData(id: string): Promise<CultureData>;
}

export class Calendar {
    constructor(data: CalendarData) {
        this._data = data;
    }

    private _data: CalendarData;

    public getInstant(julianDate: number): any {
        // If we have an offset, modify the date by it.
        if (this._data.julian) { julianDate += this._data.julian }

        // Go through each of the cycles and calculate each one. We will reset
        // the julian date for each one since each of these cycles is calculated
        // independently.
        var instant = {};

        for (var cycle of this._data.cycles) {
            this.calculateCycle(cycle, julianDate, instant);
        }

        // Return the resulting calendar instant.
        return instant;
    }

    private calculateCycle(cycle: CalendarCycleData, julianDate: number, instant: any): void {
        // Figure out what to do based on the type of the cycle.
        switch (cycle.type) {
            case "repeat":
                this.calculateRepeatCycle(cycle, julianDate, instant);
                break;

            case "calculate":
                this.calculateCalculateCycle(cycle, julianDate, instant);
                break;

            case "sequence":
                this.calculateSequenceCycle(cycle, julianDate, instant);
                break;

            default: throw "Cannot handle cycle type of " + cycle.type + ".";
        }
    }

    private calculateCalculateCycle(cycle: CalendarCycleData, julianDate: number, instant: any): void {
        var ref = cycle.ref;
        var index = instant[ref];
        var value = cycle.value;

        switch (cycle.operation) {
            case "mod": instant[cycle.id] = index % value; break;
            case "div": instant[cycle.id] = Math.floor(index / value); break;
        }

        // If we have additional cycles, we want to calculate them recursively.
        if (cycle.cycles) {
            for (var child of cycle.cycles) {
                this.calculateCycle(child, julianDate, instant);
            }
        }
    }

    private calculateRepeatCycle(cycle: CalendarCycleData, julianDate: number, instant: any): void {
        // Start with the zero index.
        instant[cycle.id] = 0;

        // Loop through the various lengths until we encounter a length that
        // exceeds the remaining Julian Date.
        var next = 0;

        while (julianDate >= 0) {
            // Calculate the length of the next cycle by finding the next one.
            var found = false;

            for (var length of cycle.lengths) {
                // Calculate the length of this length. If this is less than or
                // equal to the Julian Date, we need to keep it.
                next = this.calculateLength(length, instant);

                if (next <= 0) { continue; }

                if (next <= julianDate) {
                    instant[cycle.id] += length.count;
                    julianDate -= next;
                    found = true;
                    break;
                }
            }

            // If we fall through, then there is something wrong so break out.
            if (!found) { break; }
        }

        // If we have additional cycles, we want to calculate them recursively.
        if (cycle.cycles) {
            for (var child of cycle.cycles) {
                this.calculateCycle(child, julianDate, instant);
            }
        }
    }

    private calculateSequenceCycle(cycle: CalendarCycleData, julianDate: number, instant: any): void {
        // Start with the zero index.
        instant[cycle.id] = 0;

        //console.log("seq", cycle.id, "begin", julianDate);

        // Loop through the sequences until we exceed our limit.
        var found = false;

        for (var length of cycle.lengths) {
            // Calculate the length of this length. If this is less than or
            // equal to the Julian Date, we need to keep it and move to the next.
            var next = this.calculateLength(length, instant);

            //console.log("seq", cycle.id, "next", julianDate, next);

            if (next <= 0 || next > julianDate) { break; }

            // Adjust the instant cycle index and move to the next.
            instant[cycle.id]++;
            julianDate -= next;

            // If we hit zero, we're done.
            if (julianDate <= 0) { break; }
        }

        //console.log("seq", cycle.id, "end", julianDate, instant[cycle.id]);

        // If we have additional cycles, we want to calculate them recursively.
        if (cycle.cycles) {
            for (var child of cycle.cycles) {
                this.calculateCycle(child, julianDate, instant);
            }
        }
    }

    private calculateLength(length: CalendarLengthData, instant: any): number {
        // See if we have "single", which means a choice between multiple
        // lengths.
        if (length.single) {
            // Loop through the single lengths until we find one that is
            // applicable.
            //console.log("single", "begin");

            for (var single of length.single) {
                var singleRef = single.ref;
                var singleIndex = instant[singleRef];
                var singleValue = single.value;

                //console.log("single", "obj", single);
                //console.log("single", "ref", singleRef, singleValue);

                switch (single.operation) {
                    case "mod":
                        if (singleIndex % singleValue != 0) { continue; }
                        break;

                    case "div":
                        if (Math.floor(singleIndex / singleValue) != 0) { continue; }
                        break;
                }

                //console.log("single", "found", singleRef, singleValue);
                return single.julian;
            }
        }

        // If we have an operation, then we need to calculate this. If the
        // operation doesn't match, then return 0 to skip the cycle.
        if (length.operation) {
            var ref = length.ref;
            var index = instant[ref];
            var value = length.value;

            switch (length.operation) {
                case "mod":
                    if (index % value != 0) { return 0; }
                    break;

                case "div":
                    if (Math.floor(index / value) != 0) { return 0; }
                    break;
            }
        }

        // We have a valid value, so return the results.
        return length.julian;
    }
}

export class Culture {
    constructor(data: CultureData) {
        this._data = data;
    }

    private _data: CultureData;
    public calendar: Calendar;

    public formatInstant(instant: any, id: string): string {
        throw "Cannot format instants";
    }
}

export class CultureProvider {
    constructor(dataProvider: CultureDataProvider) {
        if (!dataProvider) {
            throw new Error("Cannot create a CultureProvider without a data provider.")
        }

        this._dataProvider = dataProvider;
    }

    private _dataProvider: CultureDataProvider;

    public getCalendarPromise(id: string): Promise<Calendar> {
        var that = this;
        return new Promise<Calendar>(
            function(resolve, error) {
                var dataPromise = that._dataProvider.getCalendarData(id);

                dataPromise.then(
                    function(data) {
                        resolve(new Calendar(data));
                    },
                    function(dataError) {
                        error(dataError);
                    });
            });
    }

    public getCulturePromise(id: string): Promise<Culture> {
        var that = this;
        return new Promise<Culture>(
            function(resolve, error) {
                var dataPromise = that._dataProvider.getCultureData(id);

                dataPromise.then(
                    function(data) {
                        // Create the base culture from the data.
                        var culture = new Culture(data);

                        // We need to load all the calendars for this culture.
                        // Since these are loaded via promises, we need to
                        // resolve all of them.
                        var calendarPromises = Array<Promise<Calendar>>();

                        if (data.temporal && data.temporal.calendars) {
                            for (var calendarId of data.temporal.calendars) {
                                var calendarPromise = that.getCalendarPromise(calendarId);
                                calendarPromises.push(calendarPromise);
                            }
                        }

                        var allCalendarPromises = Promise.all(calendarPromises);

                        allCalendarPromises.then(
                            function(promises) {
                                // If we have no promises, nothing to worry about.
                                if (promises.length == 0) {}
                                else if (promises.length == 1) {
                                    culture.calendar = promises[0];
                                }
                                else { throw new Error("Cannot assign multiple calendars."); }

                                // Resolve the culture.
                                resolve(culture);
                            }
                        )
                    },
                    function(dataError) {
                        error(dataError);
                    });
            });
    }
}
