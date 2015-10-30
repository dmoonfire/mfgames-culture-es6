/// <reference path="../../typings/node/node.d.ts"/>
/// <reference path="../../typings/jasmine/jasmine.d.ts"/>
/// <reference path="../../typings/julian/julian.d.ts"/>
import * as path from "path";
import { Calendar } from "../init";
import { NodeFilesystemCultureDataProvider } from "../node-provider";

/**
 * Calculates the Julian Date Number from a given year, month, day.
 */
export function getJulian(year: number, month: number, day: number): number {
    // Figure out the data using the formula from Wikipedia.
    var a = Math.floor((14 - month) / 12);
    var y = year + 4800 - a;
    var m = month + 12 * a - 3;
    var jdn = day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
    return jdn - 0.5;

    //// This was the original answer, but it is wrong.
    //var date = new Date(Date.UTC(year, month, day));
    //var time = date.getTime();
    //var jd = (time / 86400000) + 2440587.5 - 31;
    //return jd;
}

export function getCalendar(): Promise<Calendar> {
    return new Promise<Calendar>(
        function(resolve, error) {
            var rootDirectory = path.join(__dirname, "..", "..", "data");
            var provider = new NodeFilesystemCultureDataProvider(rootDirectory);
            var dataPromise = provider.getCalendarData("gregorian");

            dataPromise.then(function(data) {
                resolve(new Calendar(data));
            });
        });
}

export function failTest(error: any) {
    expect(error).toBeUndefined();
};
