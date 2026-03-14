import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

type PointLike = {
  x: unknown;
  y: unknown;
};

function isFiniteNumber(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value);
}

function isPoint(value: unknown): value is PointLike {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const point = value as PointLike;
  return isFiniteNumber(point.x) && isFiniteNumber(point.y);
}

function isPolygon(value: unknown): boolean {
  if (!Array.isArray(value) || value.length < 3) {
    return false;
  }

  return value.every((point) => isPoint(point));
}

export function IsPolygon(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isPolygon',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          return isPolygon(value);
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be a polygon with at least 3 points, each containing numeric x and y`;
        },
      },
    });
  };
}

export function IsPolygonCollection(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isPolygonCollection',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          return (
            Array.isArray(value) &&
            value.every((polygon: unknown) => isPolygon(polygon))
          );
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be an array of polygons; each polygon must have at least 3 points with numeric x and y`;
        },
      },
    });
  };
}
